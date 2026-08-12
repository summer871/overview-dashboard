/**
 * Remake Factor Product Attribution Audit Runner
 * Version: v1.1.6 - 2026-08-08
 * State: Prepared only - diagnostic/read-only runner
 *
 * Purpose:
 * - Provide no-argument Apps Script editor entry points for the staged
 *   RemakeFactorAttributionAudit helper.
 * - Retain the validated v1.1.3 linked-terminal and known-case QA entry points.
 * - Retain the compact 50-case previous-vs-root candidate-comparison diagnostic.
 * - Retain the narrow root-first decision-validation runner.
 * - Add compact v1.1.6 runners for non-exact single-root evidence and unresolved
 *   dashboard-presentation modeling. Neither runner applies attribution or UI changes.
 * - Retain the terminal-root behavior sampler and compact attribution sample for
 *   evidence review.
 * - Log and return results only. This file performs no cache, Drive, trigger,
 *   GitHub, or deployment writes.
 */

function runRemakeProductAttributionKnownCaseV1() {
  const result = profileRemakeProductAttributionCaseV1(375669);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionKnownCaseCompactV1() {
  const result = profileRemakeProductAttributionCaseCompactV1(375669);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionRootCandidate361499V1() {
  const result = profileRemakeAttributionCrmCaseV1(361499);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionTerminalRootSampleV1() {
  const result = profileRemakeAttributionTerminalRootBehaviorV1({
    sampleSize: 12,
    includeKnownRootCaseNumber: 361499
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionSampleV1() {
  const result = profileRemakeProductAttributionAuditV1({
    maxCases: 50,
    sampleSize: 12
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}


function runRemakeProductAttributionCandidateComparisonV1() {
  const result = profileRemakeProductAttributionCandidateComparisonV1({
    maxCases: 50,
    sampleSize: 12
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}



function runRemakeProductAttributionRootFirstDecisionValidationV1() {
  const result = profileRemakeProductAttributionRootFirstDecisionValidationV1({
    maxCases: 50
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionSampleCompactV1() {
  const result = profileRemakeProductAttributionAuditCompactV1({
    maxCases: 50,
    sampleSize: 12
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}


function runRemakeProductAttributionNonExactValidationV1() {
  const result = profileRemakeProductAttributionNonExactValidationV1({
    maxCases: 50
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeProductAttributionUnresolvedDisplayValidationV1() {
  const result = profileRemakeProductAttributionUnresolvedDisplayValidationV1({
    maxCases: 50,
    samplesPerBucket: 2
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}
