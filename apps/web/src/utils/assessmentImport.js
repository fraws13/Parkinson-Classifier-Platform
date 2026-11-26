const maxJsonSize = 64 * 1024;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function measurementIssue(name, value) {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'usa un numero valido o null';
  if (name.endsWith('_pct') && (value < 0 || value > 1)) return 'usa un valore tra 0 e 1';
  return null;
}

export async function readAssessmentJson(file, featureNames) {
  if (file.size > maxJsonSize) throw new Error('Il file supera il limite di 64 KB per un singolo test.');

  const text = await file.text();
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error('Il file contiene JSON non valido.');
  }

  if (!isObject(document) || !isObject(document.features)) {
    throw new Error('Usa un file con un solo test e un oggetto «features» contenente le misurazioni.');
  }

  const expectedNames = new Set(featureNames);
  const importedValues = {};
  const issues = [];
  for (const [name, value] of Object.entries(document.features)) {
    if (!expectedNames.has(name)) {
      issues.push(`${name}: campo non riconosciuto`);
      continue;
    }
    const issue = measurementIssue(name, value);
    if (issue) {
      issues.push(`${name}: ${issue}`);
    } else if (value !== null) {
      importedValues[name] = String(value);
    }
  }

  return { importedValues, issues };
}
