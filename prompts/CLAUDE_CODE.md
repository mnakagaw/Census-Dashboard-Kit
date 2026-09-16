# Claude Code one-country wrapper

Open an empty trusted working folder, then use `prompts/ONE_COUNTRY_COMPLETE.md`. Change only `COUNTRY_NAME` and send it once. Claude Code must follow `CLAUDE.md` and `docs/COUNTRY_COMPLETION_CONTRACT.md` and finish only after browser, Word and delivery-gate verification.

Completion requires the delivery gate to report `ready: true`.

DOM, UGA, LAO and BGD are valid target countries as well as reference lessons. For any of the 142 priority countries, read its `config/jica-priority-source-preflight.json` record, refresh the sources and create a new output. Do not return a stored example.
