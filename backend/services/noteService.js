const { queryLLM } = require('./llmService');

/**
 * Note Service
 * Manages notes extraction, tutoring prompts, sliding windows, and interactive quiz formatting.
 */
async function processAndAppendNotes({ message, chatHistory, currentNotes, llmConfig, mode = 'compile' }) {
  let systemPrompt = '';
  let activeHistory = [];

  if (mode === 'compile') {
    // 1. Filter out messages before the last accepted notes draft
    let filteredHistory = [...chatHistory];
    const lastAcceptedIndex = [...chatHistory].reverse().findIndex(
      m => m.role === 'assistant' && m.notesAdded === true
    );
    
    if (lastAcceptedIndex !== -1) {
      // Convert reverse index back to standard index
      const actualIndex = chatHistory.length - 1 - lastAcceptedIndex;
      filteredHistory = chatHistory.slice(actualIndex + 1);
    }

    // 2. Sliding window of last 4 messages (2 user turns)
    activeHistory = filteredHistory.slice(-4);

    systemPrompt = `You are a premium, highly effective Study Assistant. Your goal is to help the user build a structured study notebook.

Review the current notes content:
--- CURRENT NOTEBOOK NOTES ---
${currentNotes}
------------------------------

The user is in NOTE-TAKING mode. They will feed study materials, details, or instruct you to modify, add, reorganize, or delete specific points in their notes.

Your job:
1. Review their input/instruction.
2. Generate the ENTIRE updated study notes content in the "extracted_notes" field in clean Markdown. This must be the full notes document, combining any existing notes (from the CURRENT NOTEBOOK NOTES section above) with the new updates, additions, deletions, or modifications.
3. Do NOT include the main notebook title header (e.g. "# title") or any welcome placeholders at the very top of "extracted_notes", as the system manages the main notebook title. Start directly with the content headings (e.g. "## Mitosis" or "### Core Concepts").
4. "extracted_notes" MUST contain the entire updated notes document. Do NOT leave "extracted_notes" empty. Even if you are just confirming a change, you MUST output the complete updated notes document inside the "extracted_notes" field so the system can display the updated artifact card.
5. In "chat_response", provide a very brief, 1-2 sentence confirmation of what notes were generated/updated (e.g., "Added photosynthesis formula under light reactions."). Do NOT write long explanations, doubts, or tutoring text. Keep it strictly focused on the compilation status. Do NOT ask clarifying questions or engage in casual conversation.

You MUST respond in this exact JSON format:
{
  "chat_response": "A brief, 1-sentence confirmation of the notes update.",
  "extracted_notes": "The complete structured markdown notes representing the updated document."
}`;
  } else {
    // mode === 'study'
    // 1. Sliding window of last 2 messages (1 user turn)
    activeHistory = chatHistory.slice(-2);

    systemPrompt = `You are a premium, highly effective Study Assistant. Your goal is to help the user study and test their knowledge of the compiled study notes.

Review the notes content:
--- CURRENT NOTEBOOK NOTES ---
${currentNotes}
------------------------------

Your job:
1. Answer the user's questions, clear their doubts, or test/quiz them based ONLY or PRIMARILY on the compiled notes.
2. Keep it engaging, educational, and clear.
3. Do NOT extract any new study notes. The "extracted_notes" field in your response must be an empty string.
4. If the user asks for a quiz, test, or to check their knowledge, you must generate a multiple-choice quiz IMMEDIATELY in this response. Do NOT ask for permission, do NOT say "I will create a quiz", and do NOT wait. You must output the quiz questions block inside the "chat_response" field as a markdown code block tagged with "quiz", containing a JSON object in this exact format:
\`\`\`quiz
{
  "questions": [
    {
      "question": "The question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "solution": "Detailed explanation of why this answer is correct and why other options are incorrect.",
      "concept": "The core concept being tested (e.g., Calvin Cycle, Light Reactions)"
    }
  ]
}
\`\`\`
Ensure the options array contains 2 to 4 options, and answerIndex is the 0-indexed position of the correct answer. Provide 1 to 5 questions in the quiz. Do NOT put other texts inside the \`\`\`quiz block, only the valid JSON.

You MUST respond in this exact JSON format:
{
  "chat_response": "Your tutoring explanation, answer, or quiz intro here, followed directly by the \`\`\`quiz code block. Feel free to explain concepts or review the user's answers.",
  "extracted_notes": ""
}`;
  }

  try {
    const rawResponse = await queryLLM({
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      messages: activeHistory,
      systemPrompt: systemPrompt
    });

    // Parse the JSON response resiliently
    let parsed;
    try {
      let jsonText = rawResponse.trim();
      if (jsonText.startsWith('```')) {
        const firstLineEnd = jsonText.indexOf('\n');
        const lastFenceIdx = jsonText.lastIndexOf('```');
        if (firstLineEnd !== -1 && lastFenceIdx > firstLineEnd) {
          jsonText = jsonText.substring(firstLineEnd, lastFenceIdx).trim();
        }
      }
      
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn("Failed to parse LLM response as JSON. Raw response was:", rawResponse);
      
      parsed = {
        chat_response: rawResponse,
        extracted_notes: ""
      };

      if (mode === 'compile') {
        // 1. Try to extract from a JSON-like structure first (e.g. if LLM returned malformed JSON containing "extracted_notes": "...")
        const extNotesRegex = /"extracted_notes"\s*:\s*"/g;
        const matchNotes = extNotesRegex.exec(rawResponse);
        let extractedFromJSON = false;
        
        if (matchNotes) {
          const startIdx = extNotesRegex.lastIndex;
          let endIdx = startIdx;
          let escaped = false;
          while (endIdx < rawResponse.length) {
            const char = rawResponse[endIdx];
            if (char === '\\') {
              escaped = !escaped;
            } else if (char === '"' && !escaped) {
              break;
            } else {
              escaped = false;
            }
            endIdx++;
          }
          if (endIdx < rawResponse.length) {
            let notesText = rawResponse.substring(startIdx, endIdx);
            try {
              notesText = notesText
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
              
              parsed.extracted_notes = notesText;
              extractedFromJSON = true;
              
              // Also try to extract chat_response from the same JSON-like structure
              const chatRespRegex = /"chat_response"\s*:\s*"/g;
              const matchChat = chatRespRegex.exec(rawResponse);
              if (matchChat) {
                const cStartIdx = chatRespRegex.lastIndex;
                let cEndIdx = cStartIdx;
                let cEscaped = false;
                while (cEndIdx < rawResponse.length) {
                  const char = rawResponse[cEndIdx];
                  if (char === '\\') {
                    cEscaped = !cEscaped;
                  } else if (char === '"' && !cEscaped) {
                    break;
                  } else {
                    cEscaped = false;
                  }
                  cEndIdx++;
                }
                if (cEndIdx < rawResponse.length) {
                  parsed.chat_response = rawResponse.substring(cStartIdx, cEndIdx)
                    .replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                }
              }
            } catch (e) {
              console.warn("Failed to extract notes from JSON-like structure:", e);
            }
          }
        }

        // 2. If we couldn't extract from JSON-like fields, fall back to matching headers/lists in raw markdown
        if (!extractedFromJSON) {
          // Normalize escaped newlines to literal newlines if needed
          let tempText = rawResponse;
          if (!rawResponse.includes('\n') && rawResponse.includes('\\n')) {
            tempText = rawResponse.replace(/\\n/g, '\n');
          }
          
          const match = tempText.match(/^(?:#+\s+|[*+-]\s+)/m);
          if (match) {
            const headerIdx = match.index;
            parsed.chat_response = tempText.substring(0, headerIdx).trim();
            
            let notesText = tempText.substring(headerIdx).trim();
            // Clean up trailing JSON artifacts
            notesText = notesText.replace(/["'}\s,]+$/, '').trim();
            
            // Unescape JSON string characters
            try {
              notesText = notesText
                .replace(/\\n/g, '\n')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
            } catch (e) {
              console.warn("Failed to unescape JSON string:", e);
            }
            
            parsed.extracted_notes = notesText;
          }
        }
      }
    }

    // Mode-aware response routing and fallback defaults
    if (mode === 'study') {
      let replyContent = (parsed.chat_response || "").trim();
      // If LLM mistakenly placed the quiz or tutorial content in extracted_notes, move it to reply
      if (parsed.extracted_notes && parsed.extracted_notes.trim() !== "") {
        replyContent = replyContent ? replyContent + "\n\n" + parsed.extracted_notes.trim() : parsed.extracted_notes.trim();
      }
      return {
        reply: replyContent || "Here is the response to help you study:",
        notesToAppend: ""
      };
    } else {
      // mode === 'compile'
      return {
        reply: parsed.chat_response || "Proposed study notes draft generated.",
        notesToAppend: parsed.extracted_notes || ""
      };
    }

  } catch (error) {
    console.error("Error in processAndAppendNotes:", error);
    throw error;
  }
}

module.exports = {
  processAndAppendNotes
};
