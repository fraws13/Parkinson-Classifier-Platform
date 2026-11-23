// Dataset test subjects remain stored for evaluation, never exposed operationally.
// Imported subjects without a verified split are excluded (fail closed).
export const operationalPatients = {
  OR: [{ sourceSubjectId: null }, { datasetSplit: 'TRAIN' }],
};
