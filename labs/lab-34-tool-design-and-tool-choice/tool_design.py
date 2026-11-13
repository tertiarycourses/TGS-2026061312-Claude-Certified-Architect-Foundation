# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic>=2.0", "python-dotenv>=1.0"]
# ///
"""Lab 34, part 1: tool descriptions decide which tool Claude picks.
Same two tools, same questions, two sets of descriptions. Count the wrong picks.
Run:  uv run tool_design.py"""
import anthropic
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
client = anthropic.Anthropic()
MODEL = "claude-haiku-5-5"

SCHEMA = {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}

VAGUE = [  # KEY 1: names and descriptions that overlap: Claude has to guess
    {"name": "get_info", "description": "Gets information.", "input_schema": SCHEMA},
    {"name": "fetch_data", "description": "Fetches data for the user.", "input_schema": SCHEMA},
]
CLEAR = [  # KEY 2: what it does, what input it takes, when to use it, and when NOT to
    {"name": "get_info",
     "description": ("Look up a CUSTOMER account by email address or customer ID (CUS-NNNN). Returns name, tier and "
                     "verification status. Use it for questions about who the customer is. Not for orders or shipments."),
     "input_schema": SCHEMA},
    {"name": "fetch_data",
     "description": ("Look up an ORDER by order ID (ORD-NNNN). Returns items, amount, shipping status and delivery date. "
                     "Use it for questions about a purchase or a delivery. Not for account details."),
     "input_schema": SCHEMA},
]

QUESTIONS = {  # question -> the tool that should be picked
    "Where is my parcel for ORD-5501?": "fetch_data",
    "Is jane@example.com a Gold tier member?": "get_info",
    "How much did I pay for ORD-5502?": "fetch_data",
    "Is account CUS-0042 verified yet?": "get_info",
}

for label, tools in (("VAGUE descriptions", VAGUE), ("CLEAR descriptions", CLEAR)):
    wrong = 0
    print(f"\n== {label}")
    for question, expected in QUESTIONS.items():
        r = client.messages.create(model=MODEL, max_tokens=1024, tools=tools,
                                   tool_choice={"type": "any"},  # must call a tool: we only test WHICH one
                                   messages=[{"role": "user", "content": question}])
        picked = next(b.name for b in r.content if b.type == "tool_use")
        wrong += picked != expected
        print(f"   {'OK   ' if picked == expected else 'WRONG'} {picked:<10} <- {question}")
    print(f"   wrong picks: {wrong} of {len(QUESTIONS)}")
