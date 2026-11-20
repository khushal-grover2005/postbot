import logging
import os
from dotenv import load_dotenv
from typing import Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph, START

from app.configuration import Configuration
from app.prompts import (
    EDITOR_PROMPT,
    TWITTER_PROMPT,
    LINKEDIN_PROMPT,
    TWITTER_CRITIQUE_PROMPT,
    LINKEDIN_CRITIQUE_PROMPT,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


def _create_llm():
    """Select an LLM provider from environment variables (Groq, Gemini, or OpenAI)."""
    provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_key = (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or "").strip()

    if provider == "groq" or (not provider and groq_key):
        from langchain_groq import ChatGroq

        model = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")
        logger.info("Using Groq LLM: %s", model)
        return ChatGroq(model=model, api_key=groq_key, temperature=0)

    if provider in {"gemini", "google"} or (not provider and gemini_key):
        from langchain_google_genai import ChatGoogleGenerativeAI

        model = os.getenv("LLM_MODEL", "gemini-2.0-flash")
        logger.info("Using Gemini LLM: %s", model)
        return ChatGoogleGenerativeAI(model=model, google_api_key=gemini_key, temperature=0)

    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    logger.info("Using OpenAI LLM: %s", model)
    return ChatOpenAI(model=model, temperature=0)


llm = _create_llm()


# Define the State for the Agent
class Post(TypedDict):
    """A post written in different versions."""

    drafts: list[str]
    feedback: Optional[str]


class OverallState(TypedDict):
    user_text: str
    target_audience: str
    edit_text: str
    tweet: Post
    linkedin_post: Post
    n_drafts: int
    workflow_status: str


# Define the nodes
def editor_node(state: OverallState):
    logger.info("Entering editor_node with state: %s", state)
    prompt = f"""
        text:
        ```
        {state["user_text"]}
        ```
    """.strip()

    response = llm.invoke([SystemMessage(EDITOR_PROMPT), HumanMessage(prompt)])
    logger.info("editor_node response: %s", response.content)

    return {"edit_text": response.content}


def tweet_writer_node(state: OverallState):
    logger.info("Entering tweet_writer_node with state: %s", state)
    post = state["tweet"]
    drafts = list(post.get("drafts") or [])
    feedback = post.get("feedback") or ""
    feedback_prompt = (
        ""
        if not feedback or not drafts
        else f"""
        Tweet:
        ```
        {drafts[-1]}
        ```

        Use the feedback to improve it:
        ```
        {feedback}
        ```
        """.strip()
    )

    prompt = f"""
        text:
        ```
        {state["edit_text"]}
        ```

        {feedback_prompt}

        Target audience: {state["target_audience"]}

        Write only the text for the post
    """.strip()

    response = llm.invoke([SystemMessage(TWITTER_PROMPT), HumanMessage(prompt)])
    logger.info("tweet_writer_node response: %s", response.content)
    return {
        "tweet": {
            "drafts": [*drafts, response.content],
            "feedback": feedback,
        }
    }


def linkedin_writer_node(state: OverallState):
    logger.info("Entering linkedin_writer_node with state: %s", state)
    post = state["linkedin_post"]
    drafts = list(post.get("drafts") or [])
    feedback = post.get("feedback") or ""
    feedback_prompt = (
        ""
        if not feedback or not drafts
        else f"""
        LinkedIn post:
        ```
        {drafts[-1]}
        ```

        Use the feedback to improve it:
        ```
        {feedback}
        ```
        """.strip()
    )

    prompt = f"""
        text:
        ```
        {state["edit_text"]}
        ```

        {feedback_prompt}

        Target audience: {state["target_audience"]}

        Write only the text for the post
    """.strip()

    response = llm.invoke([SystemMessage(LINKEDIN_PROMPT), HumanMessage(prompt)])
    logger.info("linkedin_writer_node response: %s", response.content)
    return {
        "linkedin_post": {
            "drafts": [*drafts, response.content],
            "feedback": feedback,
        }
    }


def critique_tweet_node(state: OverallState):
    logger.info("Entering critique_tweet_node with state: %s", state)
    post = state["tweet"]
    drafts = list(post.get("drafts") or [])
    prompt = f"""
        Full post:
        ```
        {state["edit_text"]}
        ```

        Suggested tweet (critique this):
        ```
        {drafts[-1]}
        ```

        Target audience: {state["target_audience"]}
    """.strip()

    response = llm.invoke([SystemMessage(TWITTER_CRITIQUE_PROMPT), HumanMessage(prompt)])
    logger.info("critique_tweet_node response: %s", response.content)
    return {
        "tweet": {
            "drafts": drafts,
            "feedback": response.content,
        }
    }


def critique_linkedin_node(state: OverallState):
    logger.info("Entering critique_linkedin_node with state: %s", state)
    post = state["linkedin_post"]
    drafts = list(post.get("drafts") or [])
    prompt = f"""
        Full post:
        ```
        {state["edit_text"]}
        ```

        Suggested LinkedIn post (critique this):
        ```
        {drafts[-1]}
        ```

        Target audience: {state["target_audience"]}
    """.strip()

    response = llm.invoke([SystemMessage(LINKEDIN_CRITIQUE_PROMPT), HumanMessage(prompt)])
    logger.info("critique_linkedin_node response: %s", response.content)
    return {
        "linkedin_post": {
            "drafts": drafts,
            "feedback": response.content,
        }
    }


def supervisor_node(state: OverallState):
    logger.info("Entering supervisor_node with state: %s", state)
    if (
        len(state["tweet"]["drafts"]) >= state["n_drafts"]
        and len(state["linkedin_post"]["drafts"]) >= state["n_drafts"]
    ):
        status = "completed"
    else:
        status = "in_progress"
    return {**state, "workflow_status": status}


# Define the Edges
def should_rewrite(state: OverallState):
    tweet = state["tweet"]
    linked_post = state["linkedin_post"]
    n_drafts = state["n_drafts"]
    if len(tweet["drafts"]) >= n_drafts and len(linked_post["drafts"]) >= n_drafts:
        logger.info("should_rewrite decision: END")
        return END

    logger.info("should_rewrite decision: ['linkedin_critique', 'tweet_critique']")
    return ["linkedin_critique", "tweet_critique"]


# Build a Graph
workflow = StateGraph(OverallState, config_schema=Configuration)

workflow.add_node("editor", editor_node)
workflow.add_node("tweet_writer", tweet_writer_node)
workflow.add_node("tweet_critique", critique_tweet_node)
workflow.add_node("linkedin_writer", linkedin_writer_node)
workflow.add_node("linkedin_critique", critique_linkedin_node)
workflow.add_node("supervisor", supervisor_node)

workflow.add_edge("editor", "tweet_writer")
workflow.add_edge("editor", "linkedin_writer")

workflow.add_edge("tweet_writer", "supervisor")
workflow.add_edge("linkedin_writer", "supervisor")
workflow.add_conditional_edges("supervisor", should_rewrite)

workflow.add_edge("tweet_critique", "tweet_writer")
workflow.add_edge("linkedin_critique", "linkedin_writer")

workflow.add_edge(START, "editor")

graph = workflow.compile()
