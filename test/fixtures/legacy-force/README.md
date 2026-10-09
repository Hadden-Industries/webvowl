# Independent legacy force reference

`d3-v3.5.17.txt` is the unmodified [official D3 3.5.17 distribution](https://raw.githubusercontent.com/d3/d3/v3.5.17/d3.js).
Its SHA-256 is `0c0b24005903a9d71beb93837fc1fc618b81780f14601c729030227c16b3ef51`.
The neighboring `LICENSE.txt` retains its BSD 3-Clause terms.
The fixture is read only by the force-reference tests; it is not a production dependency or browser asset.

Tests execute it in an isolated JavaScript realm with inert timers and an independently seeded random stream, then manually step its original force implementation.
Expected trajectories therefore come from unchanged upstream code, not from a second call to the candidate's algorithm.
Do not format or regenerate the distribution from the adapted production modules.
