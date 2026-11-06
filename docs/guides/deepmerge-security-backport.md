# WebVOWL deepmerge backport

This private dependency is a security backport of MIT-licensed `deepmerge` 4.3.1 for WebVOWL's Jest configuration merger.
It is not an upstream release or a published Hadden Industries package.

The root npm override selects this tracked directory as `deepmerge`, so installation from `package-lock.json` uses the corrected implementation without a lifecycle script or runtime wrapper.
The upstream CommonJS API, `all`, options and TypeScript declarations remain available.

## Source and correction

The baseline is `dist/cjs.js` and `index.d.ts` from the [deepmerge 4.3.1 npm artifact](https://registry.npmjs.org/deepmerge/-/deepmerge-4.3.1.tgz).
The artifact's SHA-512 integrity is `sha512-3sUqbMEc77XqpdNO7FRyRog+eW3ph+GYCbj+rK+uYyRMuwsVy0rMiVtPn+QJlKFvWP/1PYpapqYn0Me2knFn+A==`.
The original CommonJS file's SHA-256 is `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`.
The original copyright and license are retained in [LICENSE](../../tooling/vendor/deepmerge/LICENSE).

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) describes returned-object prototype poisoning in `mergeObject`.
The correction excludes the string `__proto__` in the shared own-key enumeration used by both the target and source copy loops, before property reads or writes.
It covers null-prototype targets, null or primitive placeholders, and an own unsafe key on the target.

Other enumerable string keys, enumerable symbols, array behavior, cloning and custom merge options keep their existing behavior.
Formatting and removal of an unused catch binding are the only other changes to the CommonJS implementation.

The regression tests in [deepmergeSecurity.test.js](../../util/deepmergeSecurity.test.js) exercise the installed package and Jest's actual configuration-merging entry point, including alternate JSON spellings and legitimate controls.
Run them with `npm test -- --runInBand util/deepmergeSecurity.test.js`.

## Replacement

Keep this backport until a maintained upstream dependency removes the vulnerable implementation or provides an independently verified correction covering both copy loops.
Then remove the override and this directory together after the same regression tests and Jest checks pass against the replacement.
Do not substitute an older vulnerable release or remove the tests solely to clear an advisory.
