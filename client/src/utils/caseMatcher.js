export const findCaseNamesOne = (text) => {
  console.log('Raw text:', text);
  const caseRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+\[\d{4}\]\s+SG[A-Z]{2,4}\s+\d+)/gi;
  const matches = text.match(caseRegex) || [];
  console.log('Regex matches:', matches);
  return [...new Set(matches.map(match => 
    match.replace(/\s+/g, ' ').trim()
  ))];
};

export const findCaseNamesTwo = (text) => {
  console.log('Raw text:', text);
  const caseRegex = /([A-Z][\w\s&.,()-]+? v\.? [A-Z][\w\s&.,()-]+?)\s*\(?\[?\d{4}\]?\)?\s*(?:[A-Za-z]+\s+)*\d*\s*(?:SLR\(?R\)?|SLR|KB|AC|All ER|UKSC|SG[A-Z]{2,4})\s*\d+/gi;
  const matches = [];
  let match;
  while ((match = caseRegex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  console.log('Regex matches:', matches);
  return [...new Set(matches)];
};