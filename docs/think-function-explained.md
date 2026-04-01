# The `think()` Function — Step-by-Step Breakdown

## Signature

```python
def think(server, client, system_prompt_ignored=None, max_steps=100)
```

Takes the MCPServer instance, an OpenAI-compatible LLM client, and a step limit.

---

## Step 1: Pre-read all documents (zero LLM calls)

```python
doc_list = server.list_documents()        # e.g. ["lohnausweis.txt", "bank_statement.csv", "profile.json", ...]
```

Then for each file:

```python
doc = server.read_document(filepath)      # returns {filepath, type, content, structured}
all_docs[filepath] = doc
```

All documents are concatenated into one string, each truncated to 8000 chars:

```python
docs_text = "\n\n".join(
    f"=== {name} ===\n{doc['content'][:8000]}"
    for name, doc in all_docs.items()
)
```

This `docs_text` is reused in every LLM call for the rest of the run.

---

## Step 2: Pre-load tax guides (zero LLM calls)

```python
all_guides = load_all_guides("/content/.../guides")
```

Reads all `.html`/`.txt`/`.md` files from the guides folder, strips HTML tags, returns `{stem: text}`. Stored for later injection per page.

---

## Step 3: Initialize state

```python
filled_history = {}     # {page_name: {locator: value}}
llm_calls = 0
total_fields_filled = 0
visited = set()
```

---

## Step 4: Auto-navigate away from root

```python
initial = server.scan_page()
```

If page is `"root"`, `"overview"`, or `""` — try clicking these in order until one works:

1. `"tab-nav-form"`
2. `"btn-nav-personal"`
3. `"btn-login"`

---

## Step 5: Main loop — `while step < max_steps`

Each iteration does the following in order:

### 5a. Scan the page

```python
page_data = server.scan_page()
page_name = page_data["page_name"]       # e.g. "personal", "income", "deductions/professional"
elements  = page_data["elements"]        # list of {type, locator, label, value, required, ...}
```

### 5b. Skip non-form pages

If `page_name` is `"root"` / `"overview"` / `""`:

```python
server.click_element("tab-nav-form")
continue
```

### 5c. Skip already-visited pages

If `page_name in visited`:

```python
nav = server.click_element("btn-next")
if not nav.get("new_page"):
    break                                # stuck -> stop entirely
continue
```

Then mark as visited:

```python
visited.add(page_name)
```

### 5d. If review page -> submit and return

```python
if page_name == "review":
    result = server.submit_form()
    return {"submission": result, "filled_history": filled_history, "log": log_lines}
```

This is the normal exit path.

### 5e. Handle dynamic rows (before LLM sees the page)

Check if any buttons have `"add-row"` in their locator:

```python
add_btns = [e for e in elements if e["type"] == "button" and "add-row" in e["locator"].lower()]
```

Count existing rows by regex on locators:

```python
# field-personal-children-0-name -> row 0
# field-personal-children-1-name -> row 1
match = re.search(r'-(\d+)-', locator)
```

If there are **no fillable fields but an add-row button exists** -> add 1 row so fields appear:

```python
server.click_element(add_btn_locator)
page_data = server.scan_page()           # re-scan to get new fields
elements = page_data["elements"]
```

### 5f. Check if there's anything to fill

```python
fillable = [e for e in elements if e["type"] not in ("button", "text")]
```

If empty and no add-row buttons -> skip, jump to navigation (5j).

### 5g. Call the LLM — `ask_llm_for_page(page_name, elements)`

This is the **one LLM call per page**. Inside this function:

**Build the system message:**

```python
section = page_name.split("/")[0]                    # "deductions/professional" -> "deductions"
section_prompt = SECTION_PROMPTS.get(section, "")    # per-section instructions
npc_hints = _get_npc_hints(section)                  # from private_notes.json clarifications
system_msg = BASE_PROMPT + "\n" + section_prompt + npc_hints
```

**Build the user message:**

```python
user_msg = f"""## Taxpayer Documents
{docs_text}                              # ALL documents concatenated

## Previously Filled
{history_text}                           # e.g. "personal: field-name=Anna Meier, field-dob=1996-03-15"

## TAX GUIDES
{POLICY_KB_TEXT}                         # hardcoded ~2600 char policy rules
{guide_text}                             # page-specific guides from PAGE_GUIDE_MAP, each capped 3000 chars

## Current Page: {page_name}
Fields on this page:
{fields_desc}                            # JSON dump of fillable elements only
"""
```

**Filter out non-fillable elements** before sending:

```python
fillable = [f for f in fields if f["type"] not in ("button", "text")]
if not fillable:
    return {}                            # early exit, no LLM call needed
```

**Make the API call:**

```python
time.sleep(5)                            # rate limit protection
response = client.chat.completions.create(
    model=LLM_MODEL,
    max_tokens=4096,
    messages=[
        {"role": "system", "content": system_msg},
        {"role": "user", "content": user_msg}
    ]
)
```

With retry: if 429 error, sleep 45s and retry up to 3 times.

**Parse the response:**

```python
return parse_field_mapping(response.choices[0].message.content)
```

Strips markdown fences, tries `json.loads()`, falls back to regex for first `{...}` object. Returns a dict.

### 5h. NPC ask-user loop (max 3 iterations per page)

If the LLM's mapping contains `"_ask_user"`:

```python
while "_ask_user" in mapping and ask_user_iterations < 3:
    question = mapping.pop("_ask_user")

    # Show popup in UI with typing indicator
    server._bridge.notify_ask_user(question, "")

    # Ask the NPC
    result = server.ask_user(question)
    answer = result["answer"]

    # Update popup with actual answer + typewriter animation
    server._bridge.notify_ask_user(question, answer)
    time.sleep(10)

    # Append to document context for future LLM calls
    docs_text += f"\n\n=== Taxpayer Answer ===\nQ: {question}\nA: {answer}"

    # Re-ask the LLM with the updated context
    mapping = ask_llm_for_page(page_name, elements)
```

Each iteration is a fresh LLM call. The loop exits when the LLM stops including `_ask_user` or after 3 rounds.

### 5i. Handle `_rows_needed`

If the LLM returned `"_rows_needed": N`:

```python
rows_needed = int(mapping.pop("_rows_needed", 0))
if rows_needed > 0:
    # Click add-row buttons until N rows exist
    new_scan = add_rows_if_needed(page_name, elements, rows_needed)
    if new_scan:
        elements = new_scan["elements"]
        # Re-ask LLM — now it can see row-0, row-1, etc. fields
        mapping = ask_llm_for_page(page_name, elements)
        mapping.pop("_rows_needed", None)
```

### 5i-2. Fill the page — `fill_page(mapping, page_name)`

```python
thought = mapping.pop("_thought", None)   # log reasoning if present

for locator, value in mapping.items():
    if locator.startswith("_"):
        continue                           # skip metadata keys

    result = server.fill_field(locator, str(value))

    if result["success"]:
        filled_history[page_name][locator] = value
        total_fields_filled += 1
    else:
        log(f"  {locator}: {result['error']}")
```

### 5j. Navigate to next page

```python
nav_result = server.click_element("btn-next")
```

If that fails (no `new_page`), fallback through sidebar tabs in order:

```python
for nav_target in ["tab-nav-form", "nav-personal", "nav-income",
                   "nav-deductions", "nav-wealth",
                   "nav-attachments", "nav-review"]:
    r = server.click_element(nav_target)
    if r["success"] and r["new_page"]:
        break
else:
    break                                  # nothing worked -> stop
```

Then back to **5a** for the next page.

---

## Step 6: Exit

Either:

- **Normal exit**: review page reached -> `submit_form()` -> return results (step 5d)
- **Max steps reached**: loop ends -> return with `submission: None`
- **Navigation stuck**: `btn-next` + all sidebar tabs fail -> break

Returns:

```python
{
    "submission": {...} or None,
    "filled_history": {"personal": {"field-x": "val"}, "income": {...}, ...},
    "log": ["Pre-reading...", "--- Page 1: personal ---", ...]
}
```

---

## What the Code Does vs What the LLM Does

### Code (deterministic, hardcoded)

- All navigation (clicking `btn-next`, sidebar tabs, `tab-nav-form`)
- Page loop order: login -> personal -> income -> deductions -> wealth -> review
- Pre-reading all documents and guides before any LLM call
- Detecting and clicking `add-row` buttons for dynamic table rows
- Re-scanning pages after adding rows
- Submitting the form when the review page is reached
- Skipping visited pages (infinite loop prevention)
- Parsing the LLM's JSON response (stripping markdown fences, regex fallback)
- Calling `fill_field(locator, value)` for each entry in the LLM's mapping
- Orchestrating the NPC ask-user loop (detecting `_ask_user`, calling the NPC, appending answer to context, re-calling the LLM)
- Handling `_rows_needed` (adding rows, re-scanning, re-asking the LLM)
- Rate limiting (sleep 5s before each call, retry on 429)
- Logging and saving outputs

### LLM (one call per page)

Given a page's fields + all documents + guides + history of what was already filled, returns a JSON object:

```json
{
  "_thought": "Per Wegleitung: field 14.1 = Ja -> CHF 1,600",
  "field-deductions-verpflegung-amount": "1600",
  "field-deductions-pillar3a-amount": "7056",
  "_ask_user": "Do you have a subsidized canteen?",
  "_rows_needed": 2
}
```

The LLM decides:

1. **Which fields to fill** on this page (by including their locator or omitting it)
2. **What value** each field should have
3. **Whether to ask the taxpayer** something (`_ask_user` key)
4. **How many dynamic rows** are needed (`_rows_needed` key)
5. **Its reasoning** (`_thought` key, for logging/debugging)

The LLM never calls tools, never navigates, never decides what page to visit next, and never sees more than one page at a time.

---

## Data Flow Summary

```
Per page:
  scan_page() -> elements
       |
  [add rows if needed] -> re-scan
       |
  ask_llm_for_page(page_name, elements)
    System: BASE_PROMPT + SECTION_PROMPT + NPC_HINTS
    User:   docs_text + filled_history + guides + fields_json
       |
  LLM returns: {"_thought": "...", "field-x": "val", "_ask_user": "q?", "_rows_needed": 2}
       |
  [NPC loop if _ask_user] -> append answer to docs_text -> re-ask LLM
       |
  [add rows if _rows_needed] -> re-scan -> re-ask LLM
       |
  fill_field() for each locator:value
       |
  click_element("btn-next") -> next page
```
