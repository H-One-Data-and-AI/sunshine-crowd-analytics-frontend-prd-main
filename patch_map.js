const fs = require('fs');

let content = fs.readFileSync('src/components/Map.jsx', 'utf-8');

function removeBlock(startStr, endStr) {
    let startIndex = content.indexOf(startStr);
    while (startIndex !== -1) {
        let endIndex = content.indexOf(endStr, startIndex);
        if (endIndex !== -1) {
            content = content.substring(0, startIndex) + content.substring(endIndex + endStr.length);
        } else {
            break;
        }
        startIndex = content.indexOf(startStr);
    }
}

removeBlock('const getUniqueCompetitorCategories = (csvData) => {', '    };\n\n    const getGroupedCompetitorData');
removeBlock('const getGroupedCompetitorData = (csvData, currentSelectedRegions) => {', '    };\n\n    const toggleGroupAccordion');

removeBlock('const parseCSVToGeoJSON = (csvData) => {', '    const parseclientCSV = ');
removeBlock('const parseclientCSV = (csvData) => {', '    const parseCompetitorCSV = ');
removeBlock('const parseCompetitorCSV = (csvData) => {', '    // Add this useEffect after your existing dropdown close effect');

removeBlock('// Parse hexagon data only once when it changes', '    // Add this useEffect after your existing dropdown close effect');

// Replacing competitorData with competitorSummary.grouped
content = content.replace(/competitorData && \(\(\) => \{/g, 'competitorSummary && competitorSummary.grouped && (() => {');
content = content.replace(/if \(competitorData\) \{/g, 'if (competitorSummary && competitorSummary.grouped) {');
content = content.replace(/const groups = getGroupedCompetitorData\(competitorData, selectedRegions\);/g, 'const groups = competitorSummary.grouped;');


fs.writeFileSync('src/components/Map.jsx', content, 'utf-8');
console.log('Patch applied successfully');
