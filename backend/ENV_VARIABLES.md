# Environment Variables for AI Chatbot Support

## Required Variables

### `LLM_API_KEY` (Required)
- **Description**: OpenAI API key for LLM-powered intent classification
- **Type**: String
- **Example**: `sk-proj-...`
- **Where to get**: https://platform.openai.com/api-keys
- **Note**: If not set, chatbot will fallback to button-based flow only (no LLM parsing)

## Optional Variables (with defaults)

### `LLM_MODEL`
- **Description**: OpenAI model to use for chat responses
- **Type**: String
- **Default**: `gpt-3.5-turbo`
- **Options**:
  - `gpt-3.5-turbo` - Cheaper, faster, good for most use cases
  - `gpt-4-turbo-preview` - More accurate, better for complex parsing
- **Recommendation**: Start with `gpt-3.5-turbo` for cost efficiency

### `LLM_TEMPERATURE`
- **Description**: Controls randomness/creativity of LLM responses
- **Type**: Number (0.0 - 2.0)
- **Default**: `0.7`
- **Values**:
  - `0.0` - Very deterministic, same input = same output
  - `0.7` - Balanced (recommended)
  - `1.0+` - More creative, less predictable
- **Recommendation**: `0.7` for balanced responses

### `LLM_MAX_TOKENS`
- **Description**: Maximum tokens in LLM response (affects cost and length)
- **Type**: Number
- **Default**: `500`
- **Usage**:
  - `500` - For chat responses (default)
  - `200` - For conversation summaries
- **Note**: Higher = more expensive, longer responses

### `SENDER_EMAIL`
- **Description**: Support team email address
- **Type**: String (email)
- **Default**: `support@example.com`
- **Usage**:
  - Used in `contact_us` intent responses
  - Used as sender for OTP emails (when implemented)
- **Note**: Should be a valid email address

## Setup Instructions

1. Copy `.env.example` to `.env` (or `.env.development` / `.env.production`)
2. Add your OpenAI API key:
   ```bash
   LLM_API_KEY=sk-your-actual-api-key-here
   ```
3. (Optional) Adjust other variables as needed
4. Restart your backend server

## Environment-Specific Files

The backend uses different env files based on `NODE_ENV`:
- **Development**: `.env.development`
- **Production**: `.env.production`

See `backend/app.js` for configuration:
```javascript
require("dotenv").config({
    path: process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development",
});
```

## Cost Considerations

### Model Costs (approximate):
- `gpt-3.5-turbo`: ~$0.0015 per 1K tokens
- `gpt-4-turbo-preview`: ~$0.01 per 1K tokens

### Token Usage:
- Each chat message: ~500 tokens (response) + ~300 tokens (prompt) = ~800 tokens
- Each conversation summary: ~200 tokens
- **Estimated cost per 1000 conversations**: $1.20 (gpt-3.5-turbo)

### Cost Optimization Tips:
1. Use `gpt-3.5-turbo` for most use cases
2. Set `LLM_MAX_TOKENS=500` (default)
3. Enable conversation summarization (reduces context tokens)
4. Consider rate limiting to prevent abuse

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env` files to git
- Never expose `LLM_API_KEY` to frontend
- Use environment-specific files for different deployments
- Rotate API keys regularly
- Monitor API usage for unexpected spikes

## Testing Without LLM

If you want to test without OpenAI API:
1. Don't set `LLM_API_KEY`
2. Chatbot will fallback to button-based flow
3. All intent handlers still work
4. Only LLM parsing is disabled

## Troubleshooting

### Chatbot not responding with LLM:
- Check `LLM_API_KEY` is set correctly
- Check API key has sufficient credits
- Check OpenAI API status: https://status.openai.com/

### Responses too short/long:
- Adjust `LLM_MAX_TOKENS` (default: 500)
- Higher = longer responses, more cost

### Responses too random/deterministic:
- Adjust `LLM_TEMPERATURE` (default: 0.7)
- Lower = more deterministic
- Higher = more creative


