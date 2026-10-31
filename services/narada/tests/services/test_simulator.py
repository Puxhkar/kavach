from app.domain.testing.models import EndReason, Speaker
from app.domain.testing.rules import build_scenario
from app.domain.testing.situations import situations_for
from app.services.testing.simulator import simulate
from tests.conftest import FakeLLM, make_definition

DEFINITION = make_definition(prompt="Hi {{name}}. You screen candidates.")
SITUATION = next(s for s in situations_for(DEFINITION) if s.id == "silence")
SCENARIO = build_scenario(
    DEFINITION, "Rahul", "dev", "English", {"name": "Rahul"}, {"current_ctc": ("1L", "12")}, "", ""
)


async def test_agent_ending_the_call_stops_the_conversation():
    llm = FakeLLM(
        agent=["Hello Rahul, what is your CTC?", "Thanks, goodbye! [END_CALL]"],
        candidate=["About 1 lakh a month."],
    )
    transcript, reason = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10)
    assert reason is EndReason.AGENT_ENDED
    assert [t.speaker for t in transcript] == [Speaker.AGENT, Speaker.CANDIDATE, Speaker.AGENT]
    assert transcript[-1].text == "Thanks, goodbye!"


async def test_silence_reaches_the_agent_as_a_marker():
    llm = FakeLLM(agent=["What is your CTC?", "Are you there? [END_CALL]"], candidate=["(silence)"])
    transcript, _ = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10)
    assert transcript[1].silent and transcript[1].text == ""
    agent_system, agent_messages = llm.calls[-1]
    assert agent_messages[-1] == {"role": "user", "content": "(silence)"}


async def test_candidate_hang_up_and_turn_limit():
    llm = FakeLLM(agent=["Hello?"], candidate=["Busy, call later. [HANG_UP]"])
    _, reason = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10)
    assert reason is EndReason.CANDIDATE_HUNG_UP

    endless = FakeLLM(agent=["Question?"] * 5, candidate=["Answer."] * 5)
    transcript, reason = await simulate(endless, DEFINITION, SCENARIO, SITUATION, 3)
    assert reason is EndReason.TURN_LIMIT
    assert len(transcript) == 6


async def test_each_side_sees_only_its_own_instructions():
    llm = FakeLLM(agent=["Hello?", "Bye [END_CALL]"], candidate=["Hi"])
    turns = []

    async def on_turn(transcript):
        turns.append(len(transcript))

    await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10, on_turn)
    agent_system = llm.calls[0][0]
    candidate_system = llm.calls[1][0]
    assert "Hi Rahul. You screen candidates." in agent_system
    assert "screen candidates" not in candidate_system
    assert "1L" in candidate_system and "1L" not in agent_system
    assert turns == [1, 2, 3]
