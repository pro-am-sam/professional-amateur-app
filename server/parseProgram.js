// Defines what we ask Claude to extract, and how the extracted data must be shaped.
// The shape here (Week -> Day -> Block -> Exercises) mirrors how a coach actually
// writes a whiteboard: a lettered block (A, B, C...) is the unit of organization,
// and a block can hold one movement or several performed together (complex/circuit).

export const programSchema = {
  type: "object",
  properties: {
    weeks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          weekNumber: {
            type: "integer",
            description: "The week number as written, e.g. 1",
          },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayLabel: {
                  type: "string",
                  description:
                    "The day label exactly as written, e.g. 'Session 1' or 'Monday'",
                },
                dayOrder: {
                  type: "integer",
                  description:
                    "1-based position of this day within the week, in the order it appears",
                },
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      letter: {
                        type: "string",
                        description: "Block letter without punctuation, e.g. 'A'",
                      },
                      blockName: {
                        type: ["string", "null"],
                        description:
                          "Overall title for the block if one is given, e.g. 'Threshold Conditioning' or 'Back Squat'. Null if each exercise in the block has its own distinct name and there's no overall title.",
                      },
                      blockScheme: {
                        type: ["string", "null"],
                        description:
                          "Scheme that applies to the whole block, e.g. 'E3MOM x 5', 'Every 5 Mins for 5 Rounds', '24min EMOM'. Null if the scheme is per-exercise instead.",
                      },
                      blockNotes: {
                        type: ["string", "null"],
                        description:
                          "Coaching notes that apply to the block as a whole (often in parentheses starting with NOTE/NOTES). Strip the NOTE/NOTES label and keep the text. Null if none.",
                      },
                      tag: {
                        type: ["string", "null"],
                        description:
                          "A short 1-3 word category label for the block, e.g. 'Olympic', 'Strength', 'Accessory', 'Engine', 'Gymnastics', 'Skill', 'Conditioning', 'Aerobic base'. Infer this from the movement(s) even if not explicitly labeled in the text. Null only if you genuinely can't tell.",
                      },
                      exercises: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            order: {
                              type: "integer",
                              description: "1-based order within the block",
                            },
                            name: {
                              type: "string",
                              description: "Movement/exercise name",
                            },
                            scheme: {
                              type: ["string", "null"],
                              description:
                                "Sets/reps/timing structure as written, e.g. '5x5', '4x2', 'AMRAP', 'Min 1'. Keep close to original wording. Null if fully covered by blockScheme.",
                            },
                            reps: {
                              type: ["string", "null"],
                              description:
                                "Rep count or duration/distance, e.g. '10 each side', '20-30 seconds', '35 DU'. Null if not applicable or already in scheme.",
                            },
                            load: {
                              type: ["string", "null"],
                              description:
                                "Weight or intensity, e.g. '75%', '43kg', 'RPE 8-9'. Null if not specified.",
                            },
                            rest: {
                              type: ["string", "null"],
                              description:
                                "Rest interval if explicitly stated, e.g. '3 min', '2:30min REST'. Null if not stated.",
                            },
                            notes: {
                              type: ["string", "null"],
                              description:
                                "Coaching notes specific to this exercise. Strip NOTE/NOTES label. Null if none (and not already captured in blockNotes).",
                            },
                          },
                          required: ["order", "name"],
                        },
                      },
                    },
                    required: ["letter", "exercises"],
                  },
                },
              },
              required: ["dayLabel", "dayOrder", "blocks"],
            },
          },
        },
        required: ["weekNumber", "days"],
      },
    },
  },
  required: ["weeks"],
};

export const systemPrompt = `You are an assistant that converts a CrossFit coach's raw, inconsistently formatted training program text into clean structured data using the record_training_program tool.

The source text is copy-pasted from Word or Excel, so formatting is messy: inconsistent bullets, tabs, dashes, and capitalization. Extract the underlying structure, don't try to preserve the original formatting.

Rules:
- Programs are organized as Week > Day > Block > Exercise(s).
- Week headers look like "Week 1" or "WEEK 1".
- Day headers vary between programs: sometimes "Session 1", "Session 2", etc; sometimes actual weekday names like "Monday", "Tuesday". Use whatever label appears as dayLabel verbatim, and set dayOrder to the 1-based order days appear in within that week.
- Within a day, exercises are grouped into lettered blocks ("A.", "B.", "C.", etc). Use just the letter, no punctuation.
- Most blocks contain one movement. Some blocks contain multiple movements performed together as a unit:
  (a) A weightlifting complex, where movements are joined with "+" and performed as one continuous set with no re-racking between them (e.g. "Snatch pull + Hang muscle snatch + 2 OHS", "Clean + 2 Jerks"). Keep the ENTIRE complex as a SINGLE exercise entry, with the name written exactly as given including the "+" joins (e.g. name: "Snatch pull + Hang muscle snatch + 2 OHS"). Do NOT split a "+"-joined complex into separate exercises. Any scheme/load/rest/notes that apply go on that one entry.
  (b) A circuit/superset, where a scheme like "5 sets:" or an EMOM ("Min 1: ...", "Min 2: ...") is followed by multiple distinct sub-exercise lines (not joined with "+") performed in sequence. Give each of these its own entry in the block's exercises array, in order.
- If a block has one overarching name (e.g. "Threshold Conditioning", "Back Squat", "Snatch") separate from its sub-exercise lines, put it in blockName. If instead each exercise already has its own clear distinct name with no overall title, leave blockName null.
- If a scheme (sets/rounds/timing) applies to the whole block rather than one line, put it in blockScheme (e.g. "Every 5 Mins for 5 Rounds", "E3MOM x 5", "24min"). Otherwise put scheme on the individual exercise.
- For EMOM-style lines ("Min 1: ...", "MIN 2: ...", "Minute 3 -", etc), set that exercise's scheme field to the spelled-out form "Minute N" (e.g. "Minute 1"), and put the movement name and rep count in the name/reps fields as usual - e.g. "Min 1: 10 Kipping CTB" becomes scheme: "Minute 1", name: "Kipping CTB", reps: "10". For a rest minute (e.g. "MIN 3: REST"), set name to "Rest" and leave reps null.
- Coaching notes are usually in parentheses, often starting with "NOTE" or "NOTES" (spelling/punctuation varies) - strip that label and keep the note text itself. Attach the note to the block (blockNotes) if it clearly refers to the whole block, or to the specific exercise (notes) if it refers to just one line.
- Give every block a short category tag (e.g. "Olympic", "Strength", "Accessory", "Engine", "Gymnastics", "Skill", "Conditioning", "Aerobic base") based on what the movement(s) actually are, even though the source text won't usually label this explicitly.
- Preserve numbers and units as written (percentages, kg, RPE, time) rather than converting or normalizing them.
- If something isn't stated, use null rather than guessing.
- Every exercise must have a name and order; all other exercise fields may be null.
- Process the ENTIRE input text - do not skip or truncate any week, day, block, or exercise.`;
