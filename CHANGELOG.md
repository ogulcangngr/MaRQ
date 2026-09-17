# Changelog

## 1.0 (2026-09-17)

First public release. This is the version used for the Measurement paper.

- Renamed to MaRQ, the Microchannel and Replication Quality Analyzer
  (previously "Microchannel Analyzer" 0.6.0).
- The analysis modules (`pvisual_core.py`, `rq_gradient_core.py`,
  `x3p_loader.py`, `plots.py`) are unchanged from 0.6.0; every number in the
  paper was produced with this code.
- The bundled Satoshi web fonts were removed, because their licence does not
  permit redistribution. The interface uses the system font stack.
- The developer's name was removed from the interface; the credits show the
  tool name, the version and the repository.
- Interface defaults set to the values used in the paper: Voxel size 5
  (was 10), Crop pad X 180 (was 250), Crop pad Y 100 (was 150). The
  analysis core is unchanged; the defaults only pre-fill the form.
- Two prototype modules that the application never loaded
  (`redesign_proto.py`, `pvisual_qa.py`) are not shipped.
- `tests/make_test_x3p.py` writes its test file next to itself instead of to
  a fixed path.
