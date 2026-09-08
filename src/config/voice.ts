/**
 * How a man talks, as against what he is thinking.
 *
 * The sit-down is the one place in this game where somebody is in the room with
 * you, and until now the man opposite had no voice in it. Every reaction was
 * narrated — *"They do not count it in front of you, which is manners, and they
 * do not put it away either, which is an answer"* — and the narration is good,
 * but it is the same measured, ironic, perfectly-balanced sentence whoever is
 * sitting there. A hot-headed enforcer and a calculating bookkeeper produced
 * identical prose, because the prose belonged to the register rather than to
 * the person.
 *
 * So: the narration stays and he gets to speak over the top of it, in his own
 * register, drawn from a trait he actually has.
 *
 * ## Why the trait and not the stats
 *
 * The first rule of this project is that hidden stats stay hidden, and the
 * temptation here is obvious — he is angry because `loyalty` is 22, so write an
 * angry line off `loyalty`. That would be the stat leaking out through prose,
 * which is worse than printing it because it looks like character.
 *
 * Traits are the right key because a trait is *manner*. How somebody talks is
 * the most observable thing about them: you hear it the moment they open their
 * mouth, whether or not you know what it means. So the line varies with who he
 * is and tells you nothing about where any number sits — a `hot_headed` man
 * snaps at you on a hit and on a miss, and which of those happened is still
 * carried entirely by the narration beside it.
 *
 * That includes traits marked `obvious: false`. Those are unread on the crew
 * sheet, and a man whose sheet says nothing while he talks like a gambler is
 * exactly the inference the sit-down exists to sell. It reveals no number and
 * hands the player something to be wrong about.
 *
 * ## The voices
 *
 * Written to be different from each other rather than uniformly good. Several
 * of these are deliberately worse writing than the narration they sit beside,
 * because people are: they repeat themselves, they start again, they answer a
 * different question, they say more than they meant to. A line that could be
 * moved to another trait without anybody noticing is a line that has failed.
 */

/** What he says back, split by whether the move landed on him. */
export interface VoiceDef {
  landed: string[];
  missed: string[];
}

/**
 * Keyed by trait id. A man with none of these says nothing extra and the
 * narration stands alone, exactly as it did before.
 *
 * Order matters at the call site, not here: `sitdown.ts` prefers the trait a
 * player is least likely to have read.
 */
export const VOICES: Record<string, VoiceDef> = {
  hot_headed: {
    landed: [
      '“Fine. Fine. You want it done, it gets done, I said fine.”',
      '“Right. And that is the end of it, yes? Because I am not doing this again.”',
      '“You could have just asked me. Months of this and you could have just asked.”',
    ],
    missed: [
      '“No. No, we are not — do not do that. Do not sit there and do that to me.”',
      '“I have been here six years. Six. And this is the conversation we are having.”',
      '“Say what you like. I have heard all of it and I am still here, am I not?”',
    ],
  },

  calculating: {
    landed: [
      '“Alright. What does that look like in practice, exactly?”',
      '“I want to be clear what I am agreeing to. Say it once more.”',
      '“Good. Then we both know where the other one is.”',
    ],
    missed: [
      '“I do not think that is quite what is happening here. But go on.”',
      '“You are not wrong. You are just not right about the part that matters.”',
      '“Let me think about how to answer that without lying to you.”',
    ],
  },

  greedy: {
    landed: [
      '“Now that is a conversation. What kind of numbers are we saying?”',
      '“See, that is what I wanted to hear. That is all anybody wanted to hear.”',
      '“And it is on top of the usual, or instead of it? On top. Say on top.”',
    ],
    missed: [
      '“Right, and what does that put in my pocket? Nothing. That is the answer.”',
      '“Words. I have had words. Words do not go through the till.”',
      '“Everybody wants something from me for free this month.”',
    ],
  },

  loyalist: {
    landed: [
      '“You did not have to say any of that. But I am glad you did.”',
      '“I was always going to do it. It is nice to be asked, is all.”',
      '“Whatever it is, it is yours. It was yours before you sat down.”',
    ],
    missed: [
      '“I am not going anywhere, if that is what this is about.”',
      '“You have known me a long time. Long enough not to need to do this.”',
      '“I would rather you were straight with me. Even now. Especially now.”',
    ],
  },

  ambitious: {
    landed: [
      '“Then I want it in front of people. Not in a back room like this.”',
      '“Good. Because I have been ready for about a year and a half.”',
      '“And when it happens, it is mine. Not shared. Mine.”',
    ],
    missed: [
      '“I am doing the work of a man two rungs above me and getting told to wait.”',
      '“Someone is going to give me that. It does not have to be you.”',
      '“You keep saying soon. I have started writing down the dates.”',
    ],
  },

  cowardly: {
    landed: [
      '“Alright. Yes. Alright. You are being decent about it, I know that.”',
      '“I did not want it to come to a sit-down, that is all. I get nervous.”',
      '“Thank you. I mean it. I have not slept properly in a fortnight.”',
    ],
    missed: [
      '“I do not — look, can we not do this here? People can hear in here.”',
      '“Whatever you heard, it was not me. It was not me. Ask anybody.”',
      '“I am not saying no. I am not saying anything. Is that alright?”',
    ],
  },

  fearless: {
    landed: [
      '“Sure. When?”',
      '“Fine by me. I was bored anyway.”',
      '“You did not need the speech. You could have led with the job.”',
    ],
    missed: [
      '“You can lean as hard as you want. It does not do anything to me.”',
      '“Is that the part where I am supposed to be worried?”',
      '“No. And I am not going to dress it up for you either.”',
    ],
  },

  disciplined: {
    landed: [
      '“Understood. It will be done properly or it will not be done.”',
      '“Then I will need two days and nobody watching me do it.”',
      '“Right. Anything else, or is that the whole of it?”',
    ],
    missed: [
      '“That is not how any of this is supposed to work and you know it.”',
      '“I do my part. I have always done my part. That is all I will say.”',
      '“No. There is a way these things are done, and that was not it.”',
    ],
  },

  sloppy: {
    landed: [
      '“Yeah, no, definitely. Definitely. What was the first bit again?”',
      '“Course. Course. Listen, while I have got you — no. Never mind. Later.”',
      '“Done. Consider it — yeah. Done.”',
    ],
    missed: [
      '“That was not — hang on. That was not me, that was the other thing.”',
      '“I thought you knew about that. I genuinely thought you knew.”',
      '“Ah. Right. And is that why we are sitting here, or is it the other one?”',
    ],
  },

  charismatic: {
    landed: [
      '“There he is. I knew you would get there eventually.”',
      '“See, this is why people like working for you. They tell me that.”',
      '“Done. And you will not hear about it again, which is the good bit.”',
    ],
    missed: [
      '“You are asking the wrong man the wrong question. No hard feelings.”',
      '“I love this. I do. But no.”',
      '“Let me tell you what I would do, if it were me sitting where you are.”',
    ],
  },

  paranoid: {
    landed: [
      '“Who else knows we are having this conversation?”',
      '“Alright. But it stays in here. It does not go anywhere else.”',
      '“And if it goes wrong, whose name is on it? Mine. It is always mine.”',
    ],
    missed: [
      '“Somebody has been talking to you about me. I can hear it.”',
      '“Why now? You have had a year to ask me that and you asked me tonight.”',
      '“I am not answering that. Not because of the answer. Because of the question.”',
    ],
  },

  gambler: {
    landed: [
      '“Alright, I am in. I am usually in, that is my whole problem.”',
      '“Good odds. Better than most of what I have taken this month.”',
      '“Say it is done. I have got a thing at eight.”',
    ],
    missed: [
      '“I will take my chances. I usually do alright on those.”',
      '“You are asking me to play safe. I am not built for playing safe.”',
      '“Ask me again next week. I might be in a worse position.”',
    ],
  },

  old_school: {
    landed: [
      '“That is how it used to be done. Glad somebody remembers.”',
      '“Your father would have said it shorter. But he would have said the same.”',
      '“Then we are square, and I will not raise it again.”',
    ],
    missed: [
      '“There was a time nobody would have had to ask me that.”',
      '“I have buried men who did things the way you are describing.”',
      '“No. And I will not be talked round to it either, so let us not.”',
    ],
  },

  silver_tongue: {
    landed: [
      '“Well. When you put it like that I can hardly say no, can I.”',
      '“You have got me. I will admit that much and nothing else.”',
      '“Consider it agreed, before either of us says something clever.”',
    ],
    missed: [
      '“I could argue that. I could argue it well. I am choosing not to.”',
      '“That is a good line. It is not an answer, but it is a good line.”',
      '“You and I both know what you are doing. It is fine. Carry on.”',
    ],
  },

  brutal: {
    landed: [
      '“Point me at it.”',
      '“Good. I was going to do something about it anyway.”',
      '“Say the name and it stops being a problem tonight.”',
    ],
    missed: [
      '“You want it fixed or you want it neat. Not both.”',
      '“Talk is what got it this far.”',
      '“No. And when it goes the other way, remember we had this conversation.”',
    ],
  },

  family_man: {
    landed: [
      '“Thank you. That is — you do not know what that means at home.”',
      '“Alright. But I am at my daughter’s thing on Sunday, whatever happens.”',
      '“Good. I can stop lying to my wife about how this is going.”',
    ],
    missed: [
      '“I have got two kids and a mother in the same house. Think about that.”',
      '“Ask me for anything else. Anything that is not that.”',
      '“I do not bring my family into this room and I would rather you did not.”',
    ],
  },
};
