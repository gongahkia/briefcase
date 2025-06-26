export const findCaseNames = (text) => {

  const caseRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+v\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+\[\d{4}\]\s+SG[A-Z]{2,4}\s+\d+)/gi;
  
  const matches = text.match(caseRegex) || [];
  
  return [...new Set(matches.map(match => 
    match.replace(/\s+/g, ' ').trim()
  ))];
};
