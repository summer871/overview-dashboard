/**
 * Remake Factor Attribution Data Projection Runner
 * Version: v1.0.0 - 2026-08-08
 * State: Prepared only - read-only QA runner
 *
 * Requires RemakeFactorAttributionDataProjection_v1.0.0 and the existing
 * v1.1.6 attribution audit helpers in the same Apps Script project.
 */

function runRemakeFactorAttributionDataProjectionReconciliationV1() {
  const result = profileRemakeFactorAttributionDataProjectionV1({
    maxCases: 50,
    samplesPerBucket: 2
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function runRemakeFactorAttributionDataProjectionKnownCaseV1() {
  const result = profileRemakeFactorAttributionDataProjectionCaseV1(375669);
  console.log(JSON.stringify(result, null, 2));
  return result;
}
