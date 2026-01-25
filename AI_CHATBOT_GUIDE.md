# AI After-Sales Chatbot - Compact Implementation Guide

## Overview

Build an AI-powered after-sales support chatbot that:
- Handles 12 predefined support intents via Quick Intent Buttons (1-12 predefined actions)
- Free-Text Chat with LLM intent classification
- Maintains conversation Awareness (session tracking, message history)
- Executes backend actions safely (LLM never writes to DB)
- Provides hybrid Response Format (natural text + structured JSON)
- OTP Verification for sensitive operations
- Periodic Summarization to manage context length

**Architecture:** REST API (no WebSockets needed), Component + Composable pattern

---

## Predefined Actions (1-12)

| # | Intent Key | Label | Required Fields | OTP | API Endpoint |
|---|------------|-------|----------------|-----|--------------|
| 1 | `resend_ticket` | I didn't receive my ticket | email, orderNumber | No | `/support/resend-ticket` |
| 2 | `change_email` | Change my email | oldEmail, newEmail, orderNumber | Yes | `/support/change-email` |
| 3 | `check_payment_status` | Check payment status | email, orderNumber | No | `/support/check-payment-status` |
| 4 | `check_checkin_status` | Check check-in status | email, orderNumber | No | `/support/check-checkin-status` |
| 5 | `track_shipment` | Track shipment | email, orderNumber | No | `/support/track-shipment` |
| 6 | `update_shipping_address` | Update shipping address | orderNumber, address fields | Yes* | `/support/update-shipping-address` |
| 7 | `download_ticket` | Download ticket | email, orderNumber | No | `/support/download-ticket` |
| 8 | `update_attendee_info` | Update attendee information | orderNumber, attendeeId, field, value | Yes | `/support/update-attendee-info` |
| 9 | `view_order_details` | View order details | email, orderNumber | No | `/support/view-order-details` |
| 10 | `check_event_details` | Check event details | eventSlug | No | `/support/check-event-details` |
| 11 | `request_invoice` | Request invoice | email, orderNumber | No | `/support/request-invoice` |
| 12 | `contact_us` | Contact us | email, message, orderNumber (optional) | No | `/support/contact-us` |

*OTP required only if order is already processing/shipped

**Authentication:**
- **Authenticated users:** Order number optional, email pre-filled
- **Unauthenticated users:** Order number required for order-specific actions (prevents spam)

---

## Architecture & Core Concepts

### Intent Router (Frontend)

The intent router is a **state machine inside the chat widget**, not a page router.

**Flow:**
1. User clicks quick-intent button OR submits free text
2. Frontend sets `currentIntent = 'resend_ticket' | 'change_email' | ...`
3. Loads form configuration for that intent (2-4 fields)
4. Renders form **inside the same widget** (no redirect)
5. On submit → POST to backend endpoint
6. Display result message

**Component Structure:**
- **Component** (`SupportBot.vue`): UI rendering, user interaction
- **Composable** (`useSupportBot()`): Reusable logic, state management, API calls
- **Helper Functions**: Pure utility functions (formatting, validation)

### LLM Message Roles

OpenAI uses three distinct roles:

- **`system`**: Meta-instructions about bot behavior (sent once, rarely updated)
  ```json
  { "role": "system", "content": "You are a friendly support assistant..." }
  ```

- **`assistant`**: Bot's conversation responses (every time bot responds)
  ```json
  { "role": "assistant", "content": "I can help you resend your ticket..." }
  ```

- **`user`**: User's messages (every user input)
  ```json
  { "role": "user", "content": "I didn't receive my ticket" }
  ```

### Response Types

**Hybrid Approach (Recommended):**
- LLM returns natural text + JSON at end
- Example: `"I can help you resend your ticket. {\"intent\":\"resend_ticket\",\"slots\":{...}}"`
- Display natural text to user, extract JSON for backend routing

**Parsing Function:**
```javascript
function parseHybridResponse(llmResponse) {
  const jsonMatch = llmResponse.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    const naturalText = llmResponse.replace(jsonMatch[0], '').trim();
    const structuredData = JSON.parse(jsonMatch[0]);
    return { naturalResponse: naturalText, ...structuredData };
  }
  return { naturalResponse: llmResponse, intent: null, confidence: 0, slots: {} };
}
```

### Session Management

- Each conversation gets unique `sessionId` (stored in localStorage)
- Backend tracks sessions in `support_sessions` table
- Load last 5-10 messages for context
- **Periodic Summarization:** Every 5-10 messages, summarize conversation to prevent token limit issues

**Summarization Process:**
1. Load current summary + recent messages (last 10-15)
2. Call LLM to create new summary
3. Save to database
4. Use summary + recent messages for next LLM call

---

## OpenAI Integration Example

**Complete implementation for `resend_ticket` intent:**

### 1. Environment Setup

```bash
# .env (backend only - never expose to frontend)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4-turbo-preview  # or gpt-3.5-turbo for cheaper
LLM_MAX_TOKENS=500
LLM_TEMPERATURE=0.7
```

### 2. Backend Service (`backend/src/service/llmSupport.js`)

```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY
});

// All 12 supported intents
const SUPPORTED_INTENTS = [
  'resend_ticket', 'change_email', 'check_payment_status',
  'check_checkin_status', 'track_shipment', 'update_shipping_address',
  'download_ticket', 'update_attendee_info', 'view_order_details',
  'check_event_details', 'request_invoice', 'contact_us'
];

/**
 * Parse user intent from free text (Example: resend_ticket)
 * @param {Object} params - { text, context, sessionHistory }
 * @returns {Object} - { intent, confidence, slots }
 */
async function parseSupportIntent({ text, context = {}, sessionHistory = [] }) {
  try {
    // Build prompt with system instructions, context, and history
    const messages = buildIntentParsingPrompt(text, context, sessionHistory);
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: process.env.LLM_MODEL,
      messages: messages,
      temperature: parseFloat(process.env.LLM_TEMPERATURE),
      max_tokens: parseInt(process.env.LLM_MAX_TOKENS),
      response_format: { type: "json_object" } // Force JSON response
    });
    
    // Parse response
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    // Validate and return
    return validateIntentResponse(parsed);
    
  } catch (error) {
    // Handle API errors gracefully
    if (error.status === 429) {
      throw new Error('Service busy, please try again in a moment');
    }
    console.error('LLM parsing error:', error);
    return {
      intent: 'unknown',
      confidence: 0,
      slots: {}
    };
  }
}

/**
 * Build prompt for intent parsing
 */
function buildIntentParsingPrompt(text, context, sessionHistory) {
  const messages = [];
  
  // 1. System instructions
  messages.push({
    role: 'system',
    content: `You are an intent classifier for a ticketing platform support bot.
Supported intents: ${JSON.stringify(SUPPORTED_INTENTS)}.
Return ONLY valid JSON: {"intent": "...", "confidence": 0-1, "slots": {...}}.
Never invent data; leave slots null if unsure.

For "resend_ticket" intent, extract:
- email: user's email address
- orderNumber: order number if mentioned
- newEmail: alternative email if user wants tickets sent elsewhere`
  });
  
  // 2. Conversation summary (if exists)
  if (context.summary) {
    messages.push({
      role: 'system',
      content: `Conversation summary: ${context.summary}`
    });
  }
  
  // 3. Session history (last 10 messages)
  if (sessionHistory.length > 0) {
    messages.push(...sessionHistory.slice(-10));
  }
  
  // 4. User context (if logged in)
  if (context.userEmail) {
    messages.push({
      role: 'system',
      content: `User context: email=${context.userEmail}, recentOrders=${context.recentOrderIds?.join(',') || 'none'}`
    });
  }
  
  // 5. New user message
  messages.push({
    role: 'user',
    content: text
  });
  
  return messages;
}

/**
 * Validate LLM response
 */
function validateIntentResponse(parsed) {
  // Validate intent is in allowed list
  if (!SUPPORTED_INTENTS.includes(parsed.intent)) {
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
  
  // Validate slots for resend_ticket
  if (parsed.intent === 'resend_ticket') {
    // Ensure email is valid format if provided
    if (parsed.slots.email && !isValidEmail(parsed.slots.email)) {
      parsed.slots.email = null;
    }
  }
  
  return parsed;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Generate hybrid response (natural text + JSON)
 */
async function generateHybridResponse({ text, context, sessionHistory }) {
  const messages = [];
  
  messages.push({
    role: 'system',
    content: `You are a friendly support assistant for a ticketing platform.
Respond naturally and helpfully to users.
At the end of your response, ALWAYS include a JSON object with intent classification.
Format: [your natural response] {"intent":"...","confidence":0.0-1.0,"slots":{...}}`
  });
  
  if (context.summary) {
    messages.push({
      role: 'system',
      content: `Conversation summary: ${context.summary}`
    });
  }
  
  if (sessionHistory.length > 0) {
    messages.push(...sessionHistory.slice(-10));
  }
  
  if (context.userEmail) {
    messages.push({
      role: 'system',
      content: `User context: email=${context.userEmail}`
    });
  }
  
  messages.push({
    role: 'user',
    content: text
  });
  
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 500
  });
  
  return response.choices[0].message.content;
}

/**
 * Summarize conversation (called periodically)
 */
async function summarizeConversation({ messages, currentSummary }) {
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
  
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: prompt,
    temperature: 0.3, // Lower temperature for more factual summaries
    max_tokens: 200
  });
  
  return response.choices[0].message.content;
}

module.exports = {
  parseSupportIntent,
  generateHybridResponse,
  summarizeConversation
};
```

### 3. Backend Endpoint (`backend/src/routes/support.js`)

```javascript
const { parseSupportIntent } = require('../service/llmSupport');
const { sendTicketsByRegistrationId } = require('../service/email');

// POST /support/chat - Main chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message, context } = req.body;
    
    // Parse intent using LLM
    const parsed = await parseSupportIntent({
      text: message,
      context: context,
      sessionHistory: await getSessionHistory(sessionId)
    });
    
    // Handle resend_ticket intent
    if (parsed.intent === 'resend_ticket' && parsed.confidence >= 0.7) {
      // Validate slots
      const email = parsed.slots.email || context.userEmail;
      const orderNumber = parsed.slots.orderNumber;
      
      if (!email) {
        return res.json({
          naturalResponse: "I need your email address to resend the ticket.",
          intent: 'resend_ticket',
          requiresMoreInfo: true
        });
      }
      
      // Backend validates and executes (LLM never touches DB)
      const order = await findOrderByEmailAndNumber(email, orderNumber);
      if (!order) {
        return res.json({
          naturalResponse: "I couldn't find an order with that information.",
          intent: 'resend_ticket',
          requiresMoreInfo: true
        });
      }
      
      // Execute action
      await sendTicketsByRegistrationId(order.registrationId, parsed.slots.newEmail || email);
      
      return res.json({
        naturalResponse: `Tickets resent successfully to ${parsed.slots.newEmail || email}`,
        intent: 'resend_ticket',
        confidence: parsed.confidence,
        actionTaken: true,
        actionResult: { success: true, sentTo: parsed.slots.newEmail || email }
      });
    }
    
    // Low confidence or unknown intent
    if (parsed.confidence < 0.5) {
      return res.json({
        naturalResponse: "I'm not entirely sure what you need. Please select one of these options:",
        intent: parsed.intent,
        confidence: parsed.confidence,
        showButtons: true
      });
    }
    
    // Return parsed intent for frontend to show form
    return res.json({
      naturalResponse: `I can help you with ${parsed.intent}. Let me get some details.`,
      intent: parsed.intent,
      confidence: parsed.confidence,
      slots: parsed.slots
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      naturalResponse: "Sorry, I encountered an error. Please try again.",
      showButtons: true
    });
  }
});
```

### 4. Applying to Other Intents

The same pattern applies to all 12 intents:
1. Use `parseSupportIntent()` to classify user text
2. Validate slots on backend
3. Execute action using existing services
4. Return result

**Example for `change_email`:**
```javascript
if (parsed.intent === 'change_email' && parsed.confidence >= 0.7) {
  // Validate slots
  const { oldEmail, newEmail, orderNumber } = parsed.slots;
  
  // Check if OTP required
  if (requiresOTP('change_email')) {
    // Generate and send OTP
    const otp = await generateOTP(oldEmail, 'change_email');
    return res.json({ requiresOTP: true, otpSentTo: oldEmail });
  }
  
  // Execute after OTP verification
  await updateEmail(orderNumber, oldEmail, newEmail);
}
```

---

## Important Notes

### Security & Architecture

1. **No WebSockets Required**: Use standard HTTP POST requests. WebSocket only needed if streaming LLM responses token-by-token (optional enhancement).

2. **LLM Never Writes to DB**: LLM only returns `{intent, confidence, slots}`. Backend validates all inputs and executes actions. Never trust LLM output directly.

3. **API Key Storage**: Store LLM API key in backend environment variables only. Never expose to frontend.

4. **Backend Validation**: Always validate:
   - Email format
   - Order exists and email matches
   - User permissions
   - Required fields present

### OTP Verification Flow

**For sensitive operations** (change_email, update_attendee_info, update_shipping_address):

1. User submits form → Backend validates → Generates 6-digit OTP
2. Store OTP in `support_otp` table (email, purpose, code, expires_at, is_used)
3. Send OTP via email
4. User enters OTP → Backend verifies (not expired, not used)
5. Mark OTP as used → Execute action

**Database Schema:**
```sql
CREATE TABLE support_otp (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_email_purpose (email, purpose),
  INDEX idx_expires (expires_at)
);
```

### Session Management

**For conversation awareness:**
- Create `support_sessions` table (id, session_id, user_id, summary, last_intent, status)
- Create `support_messages` table (id, session_id, role, content, intent, slots, created_at)
- Load last 5-10 messages when building prompt
- Summarize every 5-10 messages to prevent token limit issues

**When to summarize:**
- Option 1: Every N messages (e.g., every 5)
- Option 2: When token count exceeds threshold (e.g., 2000 tokens)
- Option 3: Hybrid (combine both)

### Confidence Scores

**Using confidence:**
- **≥ 0.7**: High confidence → Auto-select intent, show form pre-filled
- **0.4 - 0.7**: Medium confidence → Show intent suggestions
- **< 0.4**: Low confidence → Show quick intent buttons as fallback

**How LLM provides confidence:**
- Ask LLM to include confidence in JSON response (simpler)
- Or calculate from token-level probabilities (advanced, requires API support)

### Cost Optimization

1. **Model Selection**: Use `gpt-3.5-turbo` for simple tasks, `gpt-4` only for complex parsing
2. **Token Management**: Summarize conversations, limit message history to last 10
3. **Rate Limiting**: Implement rate limits to prevent abuse
4. **Caching**: Cache common responses when possible

### Error Handling

**Edge Cases:**
- **LLM returns invalid JSON**: Fallback to natural response only, show buttons
- **LLM returns unknown intent**: Show quick intent buttons
- **Low confidence**: Show confirmation or fallback to buttons
- **API failure**: Graceful fallback to button-based flow
- **OTP expired**: Allow resend OTP

**Example:**
```javascript
try {
  const parsed = await parseSupportIntent(text);
} catch (error) {
  if (error.status === 429) {
    return { error: 'Service busy, please try again in a moment' };
  }
  // Fallback to buttons
  return {
    naturalResponse: "I'm having trouble understanding. Please select an option:",
    showButtons: true
  };
}
```

### UI/UX Best Practices

1. **Menu Support Link**: Add "Support" link in navigation menu that routes to dedicated chatbot page (`/support`)
2. **Dedicated Chatbot Page**: Full-page chatbot interface where users can interact with all 12 intents
3. **Context-Aware**: Pre-fill user data if logged in
4. **Inline Forms**: Show forms inside chat widget, not separate pages
5. **Loading States**: Show loading indicators during LLM processing
6. **Clear Error Messages**: Provide helpful error messages with next steps

---

## Quick Implementation Checklist

### Phase 1: Database Setup
- [x] Create `support_sessions` table
- [x] Create `support_messages` table
- [x] Create `support_requests` table
- [x] Create `support_otp` table

**Migration file:** `backend/migration/add-support-chatbot-tables.sql`

### Phase 2: Backend Setup
- [x] Set up LLM service (`llmSupport.js`)
- [x] Add environment variables (LLM_API_KEY, LLM_MODEL, etc.) - Note: Add to .env file
- [x] Create support API endpoints (`/support/chat`, `/support/resend-ticket`, etc.)
- [x] Implement intent handlers for all 12 intents
- [x] Add OTP verification endpoints

**Files created:**
- `backend/src/service/llmSupport.js` - LLM integration service
- `backend/src/service/support.js` - Support service with all intent handlers
- `backend/src/controller/support.js` - Support API routes
- `backend/package.json` - Added OpenAI dependency
- `backend/app.js` - Registered `/support` route

### Phase 3: Frontend Setup
- [ ] Create `SupportBot.vue` component
- [ ] Create `useSupportBot()` composable
- [ ] Implement intent router (state machine)
- [ ] Add quick intent buttons (1-12)
- [ ] Implement form rendering for each intent
- [ ] Add free-text input with LLM parsing
- [ ] Implement session management (localStorage)

### Phase 4: LLM Integration
- [ ] Test OpenAI API connection
- [ ] Implement prompt building functions
- [ ] Add conversation history tracking
- [ ] Implement periodic summarization
- [ ] Add error handling and fallbacks

### Phase 5: Polish
- [ ] Add loading states
- [ ] Improve error messages
- [ ] Add conversation persistence
- [ ] Add analytics tracking

---

## Database Schema

### Core Tables

```sql
-- Support sessions
CREATE TABLE support_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT REFERENCES app_user(id),
  user_email VARCHAR(255),
  summary TEXT,
  last_intent VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- Support messages
CREATE TABLE support_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL REFERENCES support_sessions(session_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  intent VARCHAR(50),
  confidence DECIMAL(3,2),
  slots JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Support requests
CREATE TABLE support_requests (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES support_sessions(session_id),
  registration_id INT REFERENCES registration(id),
  order_id INT REFERENCES orders(id),
  intent_type VARCHAR(50) NOT NULL,
  user_email VARCHAR(255),
  user_input JSONB,
  llm_parsed JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  action_result JSONB,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OTP verification
CREATE TABLE support_otp (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  support_request_id INT REFERENCES support_requests(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Conclusion

**Key Takeaways:**
1. **Start Simple**: Implement button + form flows first, add LLM parsing later
2. **Security First**: LLM never writes to DB, backend validates everything
3. **Hybrid Approach**: Natural language + structured JSON works best
4. **Context Management**: Use sessions, message history, and periodic summarization
5. **Always Have Fallbacks**: Buttons when LLM fails, clear error messages

**The structured approach (intents 1-12) provides value even without LLM. LLM is an enhancement, not a requirement.**

