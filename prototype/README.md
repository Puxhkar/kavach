# Narada — focused call testing prototype

A small, responsive prototype for the four workflows requested:

1. **Agent setup:** paste the calling-agent prompt, define the input variables and questions it should ask, and select candidate languages.
2. **Edge-case tests:** choose candidate situations, languages, voice profile, and repetitions. Language cases include Telugu-only calls and switching from Hinglish to Telugu mid-call.
3. **Calls and recordings:** search calls, inspect a transcript, and see where real recording playback will appear. The transcript view is structured to pair audio and transcript turns.
4. **Manual test call:** enter a phone number, choose the agent and starting language, and request a call.

## Open it

Open `index.html` in a browser. There is no build step. Agent setup, scenarios selected for tests, and sample call results are saved in that browser's local storage.

## Important boundary

This is an interactive front-end prototype. It does not dial phone numbers, connect to Plivo or Vapi, run an AI candidate, play real call recordings, call an LLM, or verify the answers an agent saved. The transcript view can read sample text aloud using browser text-to-speech; this is not the original call audio. Test runs create clearly labeled sample transcripts locally. The manual-call button never starts a call. All data is illustrative.

The prototype has no backend, test credentials, phone account, or recordings to connect. To make these four workflows live, the next implementation needs the backend and provider configuration: a copied Plivo QA flow and caller number, a Vapi breaker/candidate voice setup, webhooks for transcript/recording results, an allowlisted test number for manual calls, and a safe way to read the answers the agent stored. Language coverage also depends on the configured transcriber and voice supporting each selected language.

The intended live experience is deliberately limited to prompt + questions → selected edge cases/languages → test calls and recordings → manual call. The broader dashboard, reporting, agent inventory, and management features from the earlier prototype were removed.
