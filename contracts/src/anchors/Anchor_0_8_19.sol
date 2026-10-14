// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

// Compile anchor: forces Foundry to build the upstream 0.8.19 artifacts (Morpho Blue, AdaptiveCurveIRM) so
// scripts and tests can deploy them from bytecode (script/lib/Upstream.sol) without importing sources that
// pin different compiler versions into one file.
import {Morpho} from "morpho-blue/Morpho.sol";
import {AdaptiveCurveIrm} from "morpho-blue-irm/adaptive-curve-irm/AdaptiveCurveIrm.sol";
