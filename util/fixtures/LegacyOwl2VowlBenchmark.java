import de.uni_stuttgart.vis.vowl.owl2vowl.converter.IRIConverter;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.OWLOntologyCreationException;

/** Exercise the original converter unchanged, with a frozen acquisition boundary. */
public final class LegacyOwl2VowlBenchmark {
    private static final Map<String, byte[]> documents = new LinkedHashMap<>();
    private static final Map<String, String> mediaTypes = new LinkedHashMap<>();
    private static int requests;

    private static final class Converter extends IRIConverter {
        private long loadNanos;
        private int documentCount;
        private int closureCount;

        Converter(String iri) {
            super(IRI.create(iri));
        }

        @Override
        protected void loadOntology() throws OWLOntologyCreationException {
            long start = System.nanoTime();
            super.loadOntology();
            loadNanos = System.nanoTime() - start;
            documentCount = Math.toIntExact(manager.ontologies().count());
            closureCount = Math.toIntExact(ontology.importsClosure().count());
        }
    }

    public static void main(String[] args) throws Exception {
        for (String line : Files.readAllLines(Paths.get(args[0]), StandardCharsets.UTF_8)) {
            String[] fields = line.split("\t", 3);
            documents.put(fields[0], Files.readAllBytes(Paths.get(fields[2])));
            mediaTypes.put(fields[0], fields[1]);
        }
        URL.setURLStreamHandlerFactory(protocol -> {
            if (!protocol.equals("http") && !protocol.equals("https")) {
                return null;
            }
            return new URLStreamHandler() {
                @Override
                protected URLConnection openConnection(URL url) throws IOException {
                    final String iri = url.toExternalForm();
                    if (!documents.containsKey(iri)) {
                        throw new IOException("Unknown frozen ontology source: " + iri);
                    }
                    return new HttpURLConnection(url) {
                        @Override
                        public void connect() {
                            connected = true;
                        }

                        @Override
                        public void disconnect() {
                            connected = false;
                        }

                        @Override
                        public boolean usingProxy() {
                            return false;
                        }

                        @Override
                        public int getResponseCode() {
                            return 200;
                        }

                        @Override
                        public String getContentType() {
                            return mediaTypes.get(iri);
                        }

                        @Override
                        public String getContentEncoding() {
                            return null;
                        }

                        @Override
                        public int getContentLength() {
                            return documents.get(iri).length;
                        }

                        @Override
                        public String getHeaderField(String name) {
                            return "content-type".equalsIgnoreCase(name) ? getContentType() : null;
                        }
                        @Override
                        public InputStream getInputStream() {
                            requests++;
                            return new ByteArrayInputStream(documents.get(iri));
                        }
                    };
                }
            };
        });
        int iterations = Integer.parseInt(args[2]);
        for (int iteration = 0; iteration < iterations; iteration++) {
            requests = 0;
            long start = System.nanoTime();
            Converter converter = new Converter(args[1]);
            long initialized = System.nanoTime();
            converter.convert();
            long converted = System.nanoTime();
            final String[] output = new String[1];
            converter.export(json -> output[0] = json);
            long exported = System.nanoTime();
            boolean missingImports = converter.ontologyHasMissingImports();
            if (missingImports || converter.documentCount != documents.size()
                    || converter.closureCount != documents.size()) {
                throw new AssertionError("The legacy converter did not load the complete frozen closure");
            }
            System.out.printf(Locale.ROOT,
                "{\"kind\":\"owl2vowl-legacy-benchmark\",\"iteration\":%d,"
                + "\"initializeMs\":%.6f,\"loadMs\":%.6f,\"loadAndConvertMs\":%.6f,"
                + "\"exportMs\":%.6f,\"totalMs\":%.6f,\"documents\":%d,"
                + "\"closure\":%d,\"sourceRequests\":%d,\"missingImports\":false}%n",
                iteration, (initialized - start) / 1e6, converter.loadNanos / 1e6,
                (converted - initialized) / 1e6, (exported - converted) / 1e6,
                (exported - start) / 1e6, converter.documentCount,
                converter.closureCount, requests);
            Files.write(Paths.get(args[3]), output[0].getBytes(StandardCharsets.UTF_8));
        }
    }
}
