// Independent normalization/refinement overlay; never imports production.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {produce as rawProduce,permute} from '../compatible-artifact-v1/producer.mjs';
const require=createRequire(import.meta.url);
const rdf=require('rdf-canonize');
const sha=x=>createHash('sha256').update(x).digest('hex'),clone=structuredClone;
const lower=s=>s.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
// Core A2 structural language tags and projection B4 label ranges only.
// This is bounded normalization, not an independent RFC5646 validator.
export function normalize(source){const s=clone(source);function visit(v){if(!v||typeof v!=='object')return;if(v.kind==='language'&&typeof v.language==='string')v.language=lower(v.language);for(const child of Object.values(v))visit(child);}visit(s.structural);if(s.visualization.labelSelection.mode==='language')s.visualization.labelSelection.range=lower(s.visualization.labelSelection.range);return s;}
export async function produce(source){return rawProduce(normalize(source));}
const colorIri='https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color';
const hex='http://www.w3.org/2001/XMLSchema#hexBinary';
const named=value=>({termType:'NamedNode',value}),blank=value=>({termType:'BlankNode',value});
const json=JSON.stringify;
// A second implementation of section 6, over dataset-valued default-graph N-Quads.
export function refine(input,{nested=false,previousStop=false,doubleSelf=false}={}){
 const unique=new Map(input.map(q=>[rdf.NQuads.serialize([q]),q])),quads=[...unique.values()];
 const nodes=[...new Set(quads.flatMap(q=>[q.subject,q.object]).filter(t=>t.termType==='BlankNode').map(t=>t.value))];
 let colors=Object.fromEntries(nodes.map(b=>[b,''])),count=nodes.length?1:0,rounds=0,history=[];
 const ground=t=>['term',sha(Buffer.from(json(t.termType==='NamedNode'?['iri',t.value]:['literal',t.value,t.datatype.value,t.language||''])))];
 while(nodes.length){const next={};for(const b of nodes){const strings=[];const key=t=>t.termType==='BlankNode'?(t.value===b?['self']:['blank',colors[t.value]]):ground(t);for(const q of quads){const s=q.subject.termType==='BlankNode'&&q.subject.value===b,o=q.object.termType==='BlankNode'&&q.object.value===b;if(s||o){const k=json([key(q.subject),key(q.predicate),key(q.object)]);strings.push(k);if(doubleSelf&&s&&o)strings.push(k);}}strings.sort();next[b]=sha(Buffer.from(json([colors[b],nested?strings.map(JSON.parse):strings])));}
 rounds++;const n=new Set(Object.values(next)).size;history.push({distinct:n,colors:next});if(n<=count){if(!previousStop)colors=next;break;}colors=next;count=n;
 }
 const augmented=[...quads,...nodes.map(b=>({subject:blank(b),predicate:named(colorIri),object:{termType:'Literal',value:colors[b],datatype:named(hex),language:''},graph:{termType:'DefaultGraph',value:''}}))];return {rounds,history,colors,augmented};
}
