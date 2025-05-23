// Helper function to try parsing JSON safely
function tryParseJSON(str, errorMsg) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn(errorMsg || 'Invalid JSON', e.message);
    return str;
  }
}

exports.parseDef = function(def) {
    // Parse the Split.io definition format
    // Fix 1: Use correct newline splitting
    const lines = def.split('\n'); 
  
    const result = {
      default_treatment: null,
      treatments: {},
      traffic_allocations: {},
      targeting_rules: {}
    };
      //console.log(lines)
    for (let i = 0; i < lines.length; i++) {
  
      const line = lines[i].trim();
      
      if (!line) continue; // Skip empty lines
       
      // 1. Handle default treatment
      if (line.startsWith('default treatment:')) {
        // Fix 2: Find next non-empty line for value
        let valueIndex = i + 1;
        while (valueIndex < lines.length && !lines[valueIndex].trim()) valueIndex++;
        result.default_treatment = lines[valueIndex]?.trim();
        i = valueIndex; // Skip processed lines
        continue;
      }
  
      // 2. Handle section configurations
      // Updated regex to handle any treatment name and all terminology styles with a more flexible pattern
      // Match 'individually targeted X served' where X is not 'segments', or match the older whitelist styles, or configurations
      const sectionMatch = line.match(/(individually targeted (?!segments)\w+ served|individually targeted segments served|whitelist|whitelist segment|configurations) in ([^:]+):/);
      if (sectionMatch) {
        const [, type, section] = sectionMatch;
        const key = type.replace(/ /g, '_');
        
        if (!result.treatments[section]) {
          // Initialize with a consistent structure
          result.treatments[section] = {
            whitelist: [],
            whitelist_segment: [],
            configurations: {}
          };
        }
        
        // Handle multi-line JSON configurations
        if (type === 'configurations') {
          let valueIndex = i + 1;
          let nextNonEmptyLine = '';
          
          // Find the next non-empty line
          while (valueIndex < lines.length && 
                !lines[valueIndex].trim().startsWith('whitelist') && 
                !lines[valueIndex].trim().startsWith('individually') && 
                !lines[valueIndex].trim().startsWith('traffic') && 
                !lines[valueIndex].trim().startsWith('targeting') && 
                !lines[valueIndex].trim().startsWith('default rule')) {
            
            if (lines[valueIndex].trim()) {
              nextNonEmptyLine = lines[valueIndex].trim();
              break;
            }
            valueIndex++;
          }
          
          // Handle the case where there's no configuration (empty)
          if (!nextNonEmptyLine) {
            result.treatments[section][key] = {};
            i = valueIndex - 1;
          }
          // Handle JSON object configuration
          else if (nextNonEmptyLine.startsWith('{')) {
            let jsonStr = '';
            let braceCount = 0;
            let startIndex = valueIndex;
            
            // Collect the entire JSON object by counting braces
            while (valueIndex < lines.length) {
              const jsonLine = lines[valueIndex].trim();
              jsonStr += jsonLine;
              
              // Count opening and closing braces to determine when the JSON object ends
              for (const char of jsonLine) {
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
              }
              
              // If we've closed all braces, we're done
              if (braceCount === 0 && jsonStr.trim() !== '') break;
              
              valueIndex++;
              // Add newline for proper formatting if we're continuing
              if (valueIndex < lines.length) jsonStr += ' ';
            }
            
            // Parse the complete JSON string
            try {
              result.treatments[section][key] = JSON.parse(jsonStr);
            } catch (e) {
              console.error(`Error parsing JSON configuration for ${section}:`, e);
              result.treatments[section][key] = jsonStr || {};
            }
          } 
          // Handle other formats
          else {
            result.treatments[section][key] = nextNonEmptyLine || {};
          }
          
          i = valueIndex; // Skip processed lines
        } else {
          // Handle non-configuration sections (simple values or arrays)
          let valueIndex = i + 1;
          while (valueIndex < lines.length && !lines[valueIndex].trim()) valueIndex++;
          const nextLine = lines[valueIndex]?.trim();
          
          // Handle arrays and simple values
          try {
            if (nextLine === '[]') {
              result.treatments[section][key] = [];
            } else if (nextLine && nextLine.startsWith('[') && nextLine.endsWith(']')) {
              result.treatments[section][key] = tryParseJSON(nextLine, `Invalid array for ${type} in ${section}`);
            } else {
              result.treatments[section][key] = nextLine || '';
            }
          } catch (e) {
            console.error(`Error parsing ${type} in ${section}:`, e);
            result.treatments[section][key] = nextLine || '';
          }
          
          i = valueIndex; // Skip processed lines
        }
        continue;
      }
  
      // 3. Handle traffic allocations (Fix 5: Proper parsing)
      if (line.startsWith('traffic allocations:')) {
        // Fix 6: Get the full value including possible subsequent lines
        let allocationValue = [];
        let valueIndex = i + 1;
        while (valueIndex < lines.length && !lines[valueIndex].startsWith('targeting rules:') && !lines[valueIndex].match(/ in (\w+):/)) {
          if (lines[valueIndex].trim()) {
            allocationValue.push(lines[valueIndex].trim());
          }
          valueIndex++;
        }
        
        result.traffic_allocations.split = allocationValue
          .join(' ')
          .replace(' in Split', '')
          .trim();
  
        i = valueIndex - 1; // Adjust index
        continue;
      }
  
      // 4. Handle targeting rules - the if statement
      if (line.startsWith('targeting rules:')) {
        let ruleIndex = i + 1;
        let rules = [];
        
        // Collect all rules until we hit default rule or end of file
        while (ruleIndex < lines.length && !lines[ruleIndex].startsWith('default rule:') && !lines[ruleIndex].match(/ in (\w+):/)) {
          const ruleLine = lines[ruleIndex]?.trim();
          if (ruleLine && !ruleLine.startsWith('Comment for') && !ruleLine.startsWith('Title for')) {
            rules.push(ruleLine);
          }
          ruleIndex++;
        }
        
        // Store the rules (empty array if no rules found)
        result.targeting_rules.rules = rules.length ? rules : [];
        i = ruleIndex - 1;
        continue;
      }
      
      // 5. Handle default rule
      if (line.startsWith('default rule:')) {
        // Find next non-empty line
        let valueIndex = i + 1;
        while (valueIndex < lines.length && !lines[valueIndex].trim()) valueIndex++;
        const ruleLine = lines[valueIndex]?.trim();
        
        if (ruleLine) {
          result.targeting_rules.default_rule = {};
          
          // Parse allocation percentages for each treatment
          // Format is like: "0%:premium 100%:standard 0%:current"
          const allocations = ruleLine.split(' ');
          
          for (const allocation of allocations) {
            if (allocation && allocation.includes(':')) {
              const [percentage, treatment] = allocation.split(':');
              if (treatment && percentage) {
                result.targeting_rules.default_rule[treatment.trim()] = percentage.trim();
              }
            }
          }
        }
        i = valueIndex; // Skip processed lines
      }
    }
    
    // Process any comments and title at the end
    const commentLine = lines.find(line => line.trim().startsWith('Comment for the change:'));
    if (commentLine) {
      result.comment = commentLine.replace('Comment for the change:', '').trim();
    }
    
    const titleLine = lines.find(line => line.trim().startsWith('Title for the change:'));
    if (titleLine) {
      result.title = titleLine.replace('Title for the change:', '').trim();
    }
    
    // Return just the parsed definition structure
    return result;
  };
  