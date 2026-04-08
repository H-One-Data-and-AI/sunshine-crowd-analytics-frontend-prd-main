import re

with open('src/components/Map.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove getUniqueCompetitorCategories
content = re.sub(r'const getUniqueCompetitorCategories = .*?^    };\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 2. Remove getGroupedCompetitorData
content = re.sub(r'const getGroupedCompetitorData = .*?^    };\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 3. Remove parseCSVToGeoJSON
content = re.sub(r'const parseCSVToGeoJSON = .*?^    };\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 4. Remove parseclientCSV
content = re.sub(r'const parseclientCSV = .*?^    };\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 5. Remove parseCompetitorCSV
content = re.sub(r'const parseCompetitorCSV = .*?^    };\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 6. Remove the data useEffects
content = re.sub(r'// Parse hexagon data only once when it changes.*?^    }, \[competitorData\]);\n', '', content, flags=re.MULTILINE|re.DOTALL)

# 7. Replace competitorData usage
content = content.replace('competitorData && (() => {', 'competitorSummary && competitorSummary.grouped && (() => {')
content = content.replace('if (competitorData) {', 'if (competitorSummary && competitorSummary.grouped) {')

# 8. Replace getGroupedCompetitorData calls
content = content.replace('const groups = getGroupedCompetitorData(competitorData, selectedRegions);', 'const groups = competitorSummary.grouped;')

# 9. In useEffect for fetchData
content = content.replace("map.current.on('load', fetchData);", """
        map.current.on('load', fetchData);
    }, []);

    // Fetch data whenever selectedRegions changes
    useEffect(() => {
        fetchData();
    }, [selectedRegions]);

    // Dummy line to match
""")

# Fix the duplicate block introduced by 9 if any (just simple replace)
with open('src/components/Map.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("success")
