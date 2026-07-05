# Agent notes

## Frontend QA rule (required)

Always run frontend QA with the `bh-multi` browser harness using Brave Browser. Never use Google Chrome or the default Playwright Chromium for QA screenshots or click-through.

Workflow:

```bash
bh-multi launch qa
bh-multi run qa "
new_tab('http://localhost:<port>')
wait_for_load()
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
import time; time.sleep(1)
capture_screenshot('/tmp/qa.png')
print(page_info())
"
bh-multi stop qa
```

Launch, screenshot, and stop inside one shell session so the Brave process is not orphaned between calls.

## Anti-slop frontend rules

Follow `~/.config/agent-rules/anti-ai-slop-frontend.md`. No rainbow gradient text, no floating tag pills, no ghost corner numbers, no placeholder icon avatars, no em dashes in UI or markdown.

## Verification before done

Run tests and build before claiming completion. Do not defer verification to the user.

## bh-multi screenshot budget rule

Do not take a screenshot after every action.

Use screenshots only for:

1. initial page sanity check,
2. visually ambiguous state,
3. final verification per route,
4. failure/debug evidence.

For routine checks, prefer cheap DOM/CDP reads:

- `page_info()`
- `js("document.body.innerText")`
- `js("...query selectors...")`
- direct provider/Rabby calls via `window.ethereum.request`
- transaction/status text extraction
- `list_tabs()` for Rabby prompts

Use DOM clicks when target text is known, not coordinate screenshots:

```python
js("""[...document.querySelectorAll('button')]
  .find(b => b.innerText.includes('Connect Sepolia'))?.click()""")
```
