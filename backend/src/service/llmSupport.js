const OpenAI = require('openai');
const CustomError = require('../model/CustomError');
const {
    SUPPORT_INTENTS,
    formatSlotExtractionPrompt,
    isValidIntent,
    getIntentConfig,
    SLOT_VALIDATORS
} = require('../config/supportIntents');

// Initialize OpenAI client
let openai = null;
if (process.env.LLM_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.LLM_API_KEY
    });
}


/**
 * Validate LLM response
 */
function validateIntentResponse(parsed) {
    // Validate intent is in allowed list
    if (!isValidIntent(parsed.intent)) {
        return {
            intent: 'unknown',
            confidence: 0,
            slots: {}
        };
    }

    // Validate confidence range
    if (parsed.confidence < 0 || parsed.confidence > 1) {
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
    }

    // Validate and sanitize slots using configured validators
    if (parsed.slots && typeof parsed.slots === 'object') {
        const validatedSlots = {};
        
        Object.keys(parsed.slots).forEach(key => {
            const value = parsed.slots[key];
            
            // Skip null/undefined/empty values
            if (value === null || value === undefined || value === '') {
                return;
            }
            
            // Apply validator if one exists for this slot
            if (SLOT_VALIDATORS[key]) {
                const validated = SLOT_VALIDATORS[key](value);
                if (validated !== null && validated !== undefined) {
                    validatedSlots[key] = validated;
                }
                // If validator returns null, the slot is invalid and we skip it
            } else {
                // No validator: basic sanitization (trim strings)
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed) {
                        validatedSlots[key] = trimmed;
                    }
                } else {
                    validatedSlots[key] = value;
                }
            }
        });
        
        parsed.slots = validatedSlots;
    }

    return parsed;
}

// isValidEmail is now handled by SLOT_VALIDATORS.email

/**
 * Parse hybrid response (natural text + JSON)
 * Extracts natural language response and structured data from LLM output
 * @param {string} llmResponse - Raw response from OpenAI
 * @returns {Object} - { naturalResponse, intent, confidence, slots }
 */
function parseHybridResponse(llmResponse) {
    if (!llmResponse || typeof llmResponse !== 'string') {
        return {
            naturalResponse: "I'm sorry, I didn't understand that. Could you please rephrase?",
            intent: 'unknown',
            confidence: 0,
            slots: {}
        };
    }

    // Try to find JSON at the end of the response
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}$/);
    
    if (jsonMatch) {
        try {
            const naturalText = llmResponse.replace(jsonMatch[0], '').trim();
            const structuredData = JSON.parse(jsonMatch[0]);
            
            // Validate and return
            const validated = validateIntentResponse(structuredData);
            
            return {
                naturalResponse: naturalText || "I can help you with that.",
                intent: validated.intent,
                confidence: validated.confidence,
                slots: validated.slots || {}
            };
        } catch (error) {
            console.error('Error parsing hybrid response JSON:', error);
            // Fallback: return the whole response as natural text
            return {
                naturalResponse: llmResponse,
                intent: 'unknown',
                confidence: 0,
                slots: {}
            };
        }
    }
    
    // No JSON found, return as natural response only
    return {
        naturalResponse: llmResponse,
        intent: 'unknown',
        confidence: 0,
        slots: {}
    };
}

/**
 * Generate mock response for development (no API key needed)
 * Simple keyword-based intent detection
 */
function generateMockResponse(text, context) {
    const lowerText = text.toLowerCase();
    
    // Simple keyword matching for common intents
    let detectedIntent = 'unknown';
    let confidence = 0.3;
    const slots = {};
    
    // Extract email if present
    const emailMatch = text.match(/\b[\w.-]+@[\w.-]+\.\w+\b/i);
    if (emailMatch) {
        slots.email = emailMatch[0];
    }
    
    // Extract order number if present
    // Match patterns like: "order: ORD-123", "ORD-123", "order ORD-123", etc.
    const orderPatterns = [
        /(?:order[:\s]+)?(ORD[_-]?[\w\d]+)/i,  // "order: ORD-123" or "ORD-123"
        /order[:\s]+([A-Z0-9_-]+)/i,            // "order: 12345" or "order ABC-123"
    ];
    
    for (const pattern of orderPatterns) {
        const match = text.match(pattern);
        if (match) {
            // Use the captured group (order number) not the full match
            slots.orderNumber = match[1] || match[0];
            break;
        }
    }
    
    // Intent detection based on keywords
    if (lowerText.includes('resend') || lowerText.includes('didn\'t receive') || lowerText.includes('not receive')) {
        detectedIntent = 'resend_ticket';
        confidence = 0.8;
    } else if (lowerText.includes('payment') || lowerText.includes('paid')) {
        detectedIntent = 'check_payment_status';
        confidence = 0.8;
    } else if (lowerText.includes('checkin') || lowerText.includes('check-in') || lowerText.includes('check in')) {
        detectedIntent = 'check_checkin_status';
        confidence = 0.8;
    } else if (lowerText.includes('track') || lowerText.includes('shipment') || lowerText.includes('shipping')) {
        detectedIntent = 'track_shipment';
        confidence = 0.7;
    } else if (lowerText.includes('order detail') || lowerText.includes('view order')) {
        detectedIntent = 'view_order_details';
        confidence = 0.8;
    } else if (lowerText.includes('event detail') || lowerText.includes('event info')) {
        detectedIntent = 'check_event_details';
        confidence = 0.7;
    } else if (lowerText.includes('contact') || lowerText.includes('help') || lowerText.includes('support')) {
        detectedIntent = 'contact_us';
        confidence = 0.6;
    }
    
    // Generate natural response
    const intentConfig = getIntentConfig(detectedIntent);
    const intentLabel = intentConfig ? intentConfig.label : 'your request';
    
    let naturalResponse = `I can help you with ${intentLabel}.`;
    
    if (detectedIntent !== 'unknown' && confidence >= 0.7) {
        naturalResponse = `I understand you need help with ${intentLabel}.`;
        if (Object.keys(slots).length > 0) {
            naturalResponse += ' I have some of the information needed.';
        }
    } else {
        naturalResponse = 'I can help you with your support request. Could you tell me more about what you need?';
    }
    
    return `${naturalResponse} {"intent":"${detectedIntent}","confidence":${confidence},"slots":${JSON.stringify(slots)}}`;
}

async function generateHybridResponse({text, context, sessionHistory}) {
    // Use mock mode if explicitly enabled OR if API key is not available
    const shouldUseMock = process.env.LLM_USE_MOCK === 'true' || !process.env.LLM_API_KEY;
    
    if (shouldUseMock) {
        console.log('[MOCK MODE] Using mock LLM response (no API call)', 
            !process.env.LLM_API_KEY ? '(API key not available)' : '(explicitly enabled)');
        return generateMockResponse(text, context);
    }
    
    if (!openai) {
        // Fallback: return simple response without LLM
        return `I can help you with your support request. {"intent":"unknown","confidence":0,"slots":{}}`;
    }

    const messages = [];

    // System instructions with intent information
    messages.push({
        role: 'system',
        content: `You are a friendly support assistant for a ticketing platform.
Supported intents: ${JSON.stringify(SUPPORT_INTENTS)}.

Respond naturally and helpfully to users. Be conversational and friendly.
If you can identify what the user needs, respond appropriately and ask for any missing information.

At the end of your response, ALWAYS include a JSON object with intent classification.
Format: [your natural response] {"intent":"...","confidence":0.0-1.0,"slots":{...}}

For slot extraction:
${formatSlotExtractionPrompt()}

Important:
- If you're not sure about the intent, use "unknown" with low confidence
- Never invent data; leave slots null if unsure
- Confidence should reflect how certain you are (0.0 = not sure, 1.0 = very certain)`
    });

    // Conversation summary (if exists)
    if (context.summary) {
        messages.push({
            role: 'system',
            content: `Conversation summary: ${context.summary}`
        });
    }

    // Session history (last 10 messages)
    if (sessionHistory.length > 0) {
        messages.push(...sessionHistory.slice(-10));
    }

    // User context (if logged in)
    if (context.userEmail) {
        // Only include order numbers if we have them (helps with most intents)
        // For intents like check_event_details, this is harmless extra context
        const orderContext = context.recentOrderNumbers && context.recentOrderNumbers.length > 0
            ? `, recentOrders=${context.recentOrderNumbers.join(', ')}`
            : '';
        messages.push({
            role: 'system',
            content: `User context: email=${context.userEmail}${orderContext}`
        });
    }

    // New user message
    messages.push({
        role: 'user',
        content: text
    });

    try {
        const response = await openai.chat.completions.create({
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            messages: messages,
            temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
            max_tokens: parseInt(process.env.LLM_MAX_TOKENS || '500')
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('LLM generation error:', error);
        
        // Handle specific error types
        if (error.status === 429) {
            // Rate limit or quota exceeded
            const isQuota = error.message && (
                error.message.includes('quota') || 
                error.message.includes('billing') ||
                error.message.includes('exceeded')
            );
            const errorMessage = isQuota
                ? "I'm temporarily unavailable due to API quota limits. Please contact support or try again later."
                : "I'm receiving too many requests right now. Please wait a moment and try again.";
            
            return `${errorMessage} {"intent":"unknown","confidence":0,"slots":{}}`;
        } else if (error.status === 401) {
            // Authentication error
            return `I'm having authentication issues. Please contact support. {"intent":"unknown","confidence":0,"slots":{}}`;
        } else if (error.status >= 500) {
            // Server error
            return `The AI service is experiencing issues. Please try again in a moment. {"intent":"unknown","confidence":0,"slots":{}}`;
        }
        
        // Generic fallback for other errors
        return `I'm having trouble processing your request right now. Please try again. {"intent":"unknown","confidence":0,"slots":{}}`;
    }
}

/**
 * Summarize conversation (called periodically)
 */
async function summarizeConversation({messages, currentSummary}) {
    // Skip summarization in dev mode (not critical feature)
    const isDevMode = process.env.LLM_USE_MOCK === 'true';
    
    if (isDevMode) {
        // Return simple summary in dev mode
        if (currentSummary) return currentSummary;
        const lastMessages = messages.slice(-3).map(m => m.content).join('. ');
        return `User conversation about: ${lastMessages.substring(0, 100)}...`;
    }
    
    if (!openai) {
        return currentSummary || 'No summary available';
    }

    const prompt = [
        {
            role: 'system',
            content: 'Summarize this conversation in 1-3 sentences. Focus on user problem and key facts (email, order, event).'
        },
        {
            role: 'system',
            content: `Previous summary: ${currentSummary || 'No previous context'}`
        },
        ...messages.slice(-15) // Last 15 messages
    ];

    try {
        const response = await openai.chat.completions.create({
            model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
            messages: prompt,
            temperature: 0.3, // Lower temperature for more factual summaries
            max_tokens: 200
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('LLM summarization error:', error);
        return currentSummary || 'No summary available';
    }
}

module.exports = {
    generateHybridResponse,
    parseHybridResponse,
    summarizeConversation
};


