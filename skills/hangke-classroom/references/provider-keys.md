# Provider Keys

## Critical Boundary

Hangke Interactive Classroom does not automatically reuse the agent's current model or API key.

The service resolves model routing, media providers, TTS, PDF parsing, and search keys from its own server-side configuration.

This skill must not rely on runtime overrides for model, provider, API key, or base URL.

## Interaction Policy

- Do not begin by asking the user to paste an API key into chat.
- First recommend a provider path.
- Then ask which config path they want to use.
- The user should edit `.env.local` or server-side provider config themselves.
- Do not offer to write the key for them.
- Do not suggest temporary request-time overrides.
- If generation fails because of provider or model selection, direct the user back to server-side config.

## Preferred User Flow

1. Recommend a provider option.
2. Ask where the user wants to configure it:
   - `.env.local` (recommended for most users)
   - `server-providers.yml`
   - admin vault page `/admin/ai-models`
3. Tell the user exactly which variables or provider entries to edit.
4. Wait for the user to confirm they finished editing before continuing.

## Recommendation Paths

### 1. Lowest-Friction Setup

Recommended when the user wants to bring the service up quickly.

```env
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=openai:gpt-4o-mini
```

### 2. Better Speed / Cost Balance

Recommended when the user wants a more cost-effective classroom generation path.

```env
GOOGLE_API_KEY=...
DEFAULT_MODEL=google:gemini-3-flash-preview
```

### 3. Unified Managed Setup

Recommended when the project will be used by teachers or multiple roles.

Use the admin page:

```text
/admin/ai-models
```

Configure:

- `providers` for core model routing
- `tts` for digital-human voice
- `image` for teacher portraits and classroom assets
- `pdf` for document parsing
- `video` for classroom media
- `webSearch` for enrichment and research

## Model String Rule

When recommending `DEFAULT_MODEL`, always include the provider prefix:

- `google:gemini-3-flash-preview`
- `anthropic:claude-3-5-haiku-20241022`
- `openai:gpt-4o-mini`
- `deepseek:deepseek-chat`

Do not recommend bare model IDs.

## Preferred Config Method

For local setup, prefer `.env.local`:

```bash
cp .env.example .env.local
```

Then fill the chosen keys.

Alternative: `server-providers.yml`

```yaml
providers:
  openai:
    apiKey: sk-...
  google:
    apiKey: ...
```

## Optional Features

These features require additional provider keys beyond the core LLM path:

| Feature | Example Config | Description |
|---------|----------------|-------------|
| Web Search | `TAVILY_API_KEY` or admin `webSearch` | 补充联网资料与扩展案例 |
| Image Generation | image provider key or admin `image` | 生成教师数字人画像、插图和主题素材 |
| Video Generation | video provider key or admin `video` | 生成课堂动态演示内容 |
| TTS | TTS provider key or admin `tts` | 数字人音色与课堂语音讲述 |
| PDF Parsing | PDF provider key or admin `pdf` | 教材、教案、讲义解析 |

All optional features are additive. Core classroom generation can still work without them.
