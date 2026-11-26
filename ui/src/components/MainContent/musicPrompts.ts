import type { PromptLibraryGroup } from './PromptLibraryPanel'

export const musicModifierGroup = 'Scene Intensity & Mixing Modifiers'
export const musicPromptField = 'non_diegetic_music:'

export function insertMusicPrompt(draft: string, direction: string, modifier: boolean): string {
  // Mask spoken words so a character saying a field name cannot split it.
  const structure = draft.replace(/<d>[\s\S]*?<\/d>/gi, dialogue => ' '.repeat(dialogue.length))
  const fields = [...structure.matchAll(/\b(subject_definitions|summary|retention_analysis|detailed_description|overall_soundscape|non_diegetic_music)[ \t]*:/gi)]
  const body = draft.trimEnd()
  const lastField = fields.at(-1)
  const lastLineStart = body.lastIndexOf('\n') + 1
  if (lastField && lastField.index < lastLineStart) {
    const fieldLineStart = structure.lastIndexOf('\n', lastField.index) + 1
    if (structure.slice(fieldLineStart, lastField.index).trim()) {
      // A complete inline H3 window can be followed by a plain-text window.
      return `${body} ${musicPromptField} ${direction}${draft.slice(body.length)}`
    }
  }

  const names = fields.map(field => field[1].toLowerCase())
  const sceneStart = Math.max(0, names.lastIndexOf('subject_definitions'))
  const musicIndex = names.lastIndexOf('non_diegetic_music')
  if (musicIndex >= sceneStart) {
    const field = fields[musicIndex]
    const valueStart = field.index + field[0].length
    const valueEnd = fields[musicIndex + 1]?.index ?? draft.length
    const original = draft.slice(valueStart, valueEnd)
    const existing = original.trim()
    const leading = existing ? original.match(/^\s*/)?.[0] || ' ' : ' '
    const trailing = original.slice(original.trimEnd().length)
    const updated = modifier && existing && !/^n\/?a\.?$/i.test(existing)
      ? `${existing} ${direction}` : direction
    return `${draft.slice(0, valueStart)}${leading}${updated}${trailing}${draft.slice(valueEnd)}`
  }

  const sceneFields = fields.slice(sceneStart + 1)
  const multiline = sceneFields.some(field => /\n[ \t]*$/.test(structure.slice(0, field.index)))
  const separator = multiline ? (draft.includes('\r\n') ? '\r\n' : '\n') : ' '
  return `${body}${body ? separator : ''}${musicPromptField} ${direction}${draft.slice(body.length)}`
}

export const musicPromptGroups: readonly PromptLibraryGroup[] = [
  {
    title: "Quick Pick",
    entries: [
      ["Cinematic Tension", "A dark cinematic score with deep pulsing bass, restrained strings, subtle rhythmic percussion, and a gradual buildup of tension and anticipation."],
      ["Mysterious Investigation", "A mysterious cinematic score with soft piano, delicate pizzicato strings, subtle atmospheric drones, and an intriguing investigative rhythm."],
      ["Imminent Danger", "An ominous cinematic score featuring deep drones, low brass, trembling strings, rhythmic percussion, and steadily increasing intensity."],
      ["Heartfelt Emotion", "A tender cinematic score with expressive piano, emotional cello, warm strings, and a gentle melody creating a deeply heartfelt atmosphere."],
      ["Ticking Suspense", "A tense rhythmic orchestral score with ticking percussion, repeating strings, pulsing bass, and gradually escalating intensity emphasizing urgency."],
      ["Dramatic Revelation", "A suspenseful cinematic score with a slow buildup, rising strings, subtle rhythmic pulses, and a powerful dramatic orchestral accent at the revelation."],
      ["Melancholic Piano", "A slow emotional piano score with delicate sustained strings, expressive cello, and a bittersweet melody conveying sadness and loss."],
      ["Cinematic Action", "An energetic orchestral action score with driving percussion, rapid strings, powerful brass, and pulsing bass creating intense cinematic momentum."],
      ["Romantic Warmth", "A warm romantic cinematic score with gentle piano, sweeping strings, soft acoustic textures, and a beautiful intimate melody."],
      ["Emotional Resolution", "A beautiful cinematic closing score with warm piano, swelling orchestral strings, and a gradual emotional resolution that fades naturally."],
      ["Unresolved Suspense", "A dark suspenseful cinematic score with rising strings, deep pulsing bass, subtle percussion, and an unresolved final musical note creating a powerful cliffhanger."],
      ["Playful Mischief", "A playful comedic score featuring bouncing pizzicato strings, quirky woodwinds, light percussion, mischievous piano, and exaggerated musical accents."],
    ],
  },
  {
    title: "Thriller & Suspense",
    entries: [
      ["Slow-Build Tension", "A dark, slowly building cinematic score with deep drones, subtle strings, and soft rhythmic pulses that gradually increase tension."],
      ["Psychological Tension", "An unsettling psychological thriller score with dissonant piano notes, low atmospheric drones, subtle reversed textures, and uneasy anticipation."],
      ["Heartbeat Suspense", "A tense rhythmic score with deep heartbeat-like percussion, pulsing bass, and gradually intensifying orchestral layers."],
      ["Ticking Clock", "A tense rhythmic orchestral score with ticking percussion, repeating strings, and a steadily increasing tempo creating urgency."],
      ["Suspicious Atmosphere", "A subtle suspense score featuring muted low strings, soft metallic textures, sparse piano notes, and mysterious ambience."],
      ["Cat-and-Mouse", "A clever suspense score with rhythmic pizzicato strings, subtle percussion, and shifting musical patterns suggesting a dangerous game."],
      ["Hidden Secret", "A mysterious cinematic score with soft piano, dark ambient strings, and slowly rising tonal layers hinting at a secret."],
      ["Approaching Danger", "A dark cinematic score with low brass, ominous strings, deep percussion, and gradually rising intensity."],
      ["Suspenseful Reveal", "A suspenseful orchestral score that builds through trembling strings and rising tonal layers before a dramatic musical sting."],
      ["Unresolved Cliffhanger", "A dark suspense score with rising strings, deep pulsing bass, subtle percussion, and an unresolved final musical note."],
      ["Paranoia", "A tense score with repetitive piano motifs, dissonant strings, restrained electronic pulses, and a feeling of uncertainty."],
      ["Conspiracy", "A dark conspiratorial soundtrack with deep drones, restrained electronic pulses, ominous strings, and shadowy atmosphere."],
      ["Threatening Presence", "A menacing score with low cello, deep brass, sparse percussion, and slow ominous musical movement."],
      ["Escape Pressure", "A rapidly escalating thriller score with urgent strings, pulsing bass, rhythmic percussion, and mounting desperation."],
      ["Quiet Suspense", "Minimal suspense music with soft drones, isolated piano notes, restrained strings, and carefully controlled tension."],
    ],
  },
  {
    title: "Mystery & Detective",
    entries: [
      ["Classic Detective", "A stylish detective soundtrack with mysterious piano, brushed percussion, muted jazz brass, upright bass, and an intriguing atmosphere."],
      ["Crime Investigation", "A dark investigation score with low pulsing bass, restrained strings, subtle electronic textures, and a steady investigative rhythm."],
      ["Puzzle Solving", "A curious score with playful piano patterns, light pizzicato strings, subtle ticking percussion, and a sense of discovery."],
      ["Uncovering Clues", "A mysterious cinematic score with delicate plucked strings, soft piano, atmospheric pads, and rising notes suggesting clues coming together."],
      ["Case Files", "A restrained detective score with muted piano, rhythmic bass, soft percussion, and a methodical investigative mood."],
      ["Suspicious Character", "A subtle sinister score with low cello notes, sparse piano, dissonant strings, and hidden-motive undertones."],
      ["Secret Passage", "A mysterious score with airy drones, delicate bells, low strings, and slow musical movement suggesting discovery."],
      ["Investigation Montage", "A steady cinematic investigative score with repeating piano motifs, subtle percussion, plucked strings, and gradual forward momentum."],
      ["Evidence Reveal", "A cinematic mystery score that begins with sparse piano and atmospheric strings before a restrained dramatic swell."],
      ["Whodunit", "A playful yet mysterious detective score with pizzicato strings, woodwinds, light percussion, and clever musical turns."],
      ["Cold Case", "A melancholic investigative score with muted piano, soft cello, restrained ambient textures, and a reflective sense of time passing."],
      ["Unexpected Witness", "A tense investigative score with low strings, subtle rhythmic pulses, and a gradual build toward a revelation."],
    ],
  },
  {
    title: "Horror & Dark Atmosphere",
    entries: [
      ["Haunted Atmosphere", "Eerie horror ambience featuring ghostly drones, distant metallic textures, soft dissonant strings, and unsettling atmospheric sounds."],
      ["Supernatural", "A haunting supernatural score with ethereal vocal textures, reversed piano, eerie strings, and dark atmospheric drones."],
      ["Creeping Dread", "A slowly evolving horror score with deep rumbling drones, sparse high-pitched tones, subtle dissonance, and growing dread."],
      ["Psychological Horror", "A disturbing score featuring distorted piano, unsettling sustained strings, dissonant tones, and unstable atmospheric textures."],
      ["Nightmare", "A surreal dark score with warped musical tones, ghostly textures, dissonant strings, and dreamlike unsettling ambience."],
      ["Abandoned Place", "A desolate atmospheric score with distant piano, hollow drones, subtle wind-like textures, and sparse eerie musical notes."],
      ["Monster Reveal", "A powerful horror orchestral score with aggressive low brass, dissonant strings, deep percussion, and a dramatic impact."],
      ["Haunted House", "An eerie score with creaking tonal textures, low drones, haunting piano, and distant dissonant strings."],
      ["Dark Ritual", "An ominous cinematic score with deep ceremonial percussion, haunting choir textures, low drones, and supernatural tension."],
      ["Unseen Entity", "A subtle horror score with low-frequency drones, delicate dissonant tones, sparse percussion, and a sense of something unseen nearby."],
      ["Ghostly Memory", "A haunting emotional score with distant piano, ethereal pads, soft strings, and a mournful supernatural atmosphere."],
      ["Chilling Ending", "A horror ending score with a low sustained drone, haunting high tone, and slowly fading dissonant texture."],
    ],
  },
  {
    title: "Romance & Love",
    entries: [
      ["Romantic Introduction", "A soft romantic cinematic score with delicate piano, warm strings, gentle acoustic guitar, and a dreamy intimate atmosphere."],
      ["Falling in Love", "A tender romantic score with flowing piano melodies, warm orchestral strings, gentle rhythmic movement, and uplifting emotion."],
      ["First Kiss", "A dreamy romantic orchestral score with soft piano, swelling strings, delicate harp, and a gentle emotional crescendo."],
      ["Romantic Tension", "A subtle romantic score with delicate piano, restrained strings, gentle pulsing rhythms, and anticipation."],
      ["Unrequited Love", "A melancholic romantic score with lonely piano, emotional cello, soft atmospheric strings, and longing."],
      ["Romantic Tragedy", "A tragic romantic orchestral score with emotional piano, sweeping strings, slow dramatic harmonies, and heartbreak."],
      ["Happy Romance", "A cheerful romantic score featuring bright piano, warm strings, light acoustic guitar, and an uplifting melody."],
      ["Intimate Moment", "A gentle score with soft piano, warm sustained strings, subtle ambient textures, and a tender understated mood."],
      ["Love Confession", "An emotional romantic score that slowly builds from delicate piano into warm swelling strings."],
      ["Longing", "A wistful score with expressive piano, soft cello, delicate strings, and a melody conveying distance and yearning."],
      ["Wedding Romance", "A graceful cinematic score with lyrical strings, gentle piano, warm orchestral harmonies, and joyful tenderness."],
      ["Romantic Reunion", "A heartfelt score with tender piano, rising strings, and a hopeful orchestral swell expressing reunion and relief."],
    ],
  },
  {
    title: "Emotional Drama",
    entries: [
      ["Sadness", "A gentle emotional piano score with slow melodies, delicate strings, and soft atmospheric layers conveying vulnerability."],
      ["Heartbreak", "A deeply emotional cinematic score featuring lonely piano notes, expressive cello, soft strings, and heartbreak."],
      ["Loss and Grief", "A solemn score featuring slow piano, soft cello, restrained strings, and spacious textures conveying grief."],
      ["Emotional Sacrifice", "A powerful emotional score with delicate piano, rising strings, warm orchestral harmonies, and bittersweet sacrifice."],
      ["Nostalgia", "A nostalgic score featuring gentle piano, warm strings, soft acoustic guitar, and a dreamy melody recalling memories."],
      ["Hope", "An inspiring score with gentle piano, warm strings, soft rhythmic percussion, and a rising melody expressing renewal."],
      ["Heartwarming", "A heartwarming orchestral score featuring gentle piano, soft strings, warm woodwinds, and tender uplifting melody."],
      ["Emotional Climax", "A powerful emotional score building from delicate piano into sweeping strings and expressive orchestral harmonies."],
      ["Bittersweet Ending", "A bittersweet score featuring gentle piano, emotional cello, soft strings, and a beautiful unresolved melody."],
      ["Forgiveness", "A tender score with warm piano, soft strings, subtle woodwinds, and a gradual hopeful musical resolution."],
      ["Family Reunion", "A warm emotional score with lyrical piano, gentle strings, and uplifting orchestral layers expressing love and belonging."],
      ["Quiet Reflection", "A minimalist reflective score with sparse piano, soft ambient textures, and gentle sustained strings."],
      ["Personal Loss", "A restrained emotional score with slow cello, delicate piano, and spacious harmonies conveying absence and remembrance."],
      ["Second Chance", "A hopeful emotional score with gentle piano, gradually swelling strings, and a warm melody suggesting new beginnings."],
    ],
  },
  {
    title: "Action & Adventure",
    entries: [
      ["Action Sequence", "An energetic cinematic action score with powerful orchestral percussion, driving strings, aggressive brass, and rhythmic pulses."],
      ["Chase Scene", "A fast-paced chase score with pounding percussion, rapid string patterns, pulsing bass, and escalating orchestral energy."],
      ["Escape", "A tense action score with rhythmic drums, fast strings, pulsing electronic bass, and increasing urgency."],
      ["Fight Scene", "A powerful aggressive score with heavy percussion, dramatic brass, rhythmic strings, and intense orchestral accents."],
      ["Dangerous Mission", "A dramatic action thriller score with low brass, driving percussion, rhythmic strings, pulsing bass, and determination."],
      ["Hero Entrance", "A triumphant orchestral score with bold brass, powerful percussion, sweeping strings, and a heroic musical rise."],
      ["Victory", "A triumphant orchestral score featuring soaring brass, uplifting strings, powerful percussion, and a victorious melody."],
      ["Last-Second Escape", "A rapidly escalating score with ticking percussion, pounding drums, urgent strings, and a dramatic release."],
      ["Epic Confrontation", "An epic score with powerful low brass, dramatic percussion, sweeping strings, and an intense crescendo."],
      ["Aftermath", "A restrained score with fading percussion, emotional strings, and deep atmospheric tones reflecting exhaustion."],
      ["Adventure Journey", "An uplifting adventure score with rhythmic strings, bright brass, woodwinds, and energetic percussion."],
      ["Exploration", "A curious cinematic score with gentle orchestral movement, light percussion, warm strings, and a sense of discovery."],
      ["Treasure Discovery", "A magical adventure score with shimmering strings, sparkling bells, bold brass, and a triumphant wonder-filled flourish."],
      ["Survival", "A tense atmospheric action score with deep pulses, restrained percussion, gritty strings, and determined forward momentum."],
    ],
  },
  {
    title: "Comedy & Whimsy",
    entries: [
      ["Light Comedy", "A cheerful comedic score with playful pizzicato strings, light woodwinds, bouncy piano, and whimsical rhythmic accents."],
      ["Silly Comedy", "A goofy soundtrack with exaggerated orchestral stabs, playful bassoon, bouncing pizzicato strings, and mischievous rhythms."],
      ["Sneaky Character", "A playful sneaky score with soft pizzicato strings, tiptoeing percussion, muted woodwinds, and mischievous patterns."],
      ["Awkward Moment", "A subtle awkward comedy score with sparse piano notes, gentle pizzicato strings, and humorous uncomfortable pauses."],
      ["Slapstick", "An energetic slapstick score with bouncy orchestral rhythms, playful percussion, cartoonish woodwinds, and exaggerated accents."],
      ["Funny Reveal", "A playful score with a short suspenseful buildup followed by a surprising cheerful orchestral accent and quirky flourish."],
      ["Embarrassment", "A light awkward score with hesitant piano notes, soft pizzicato strings, and subtle musical pauses."],
      ["Chaos", "A chaotic comedic score with fast playful strings, exaggerated percussion, quirky brass accents, and shifting rhythms."],
      ["Cute Characters", "An adorable whimsical score with light piano, soft ukulele, playful woodwinds, gentle bells, and cheerful textures."],
      ["Comedy Ending", "A cheerful comedic ending score with playful piano, bouncy strings, light percussion, and a charming flourish."],
      ["Prank", "A mischievous score with plucked strings, sneaky woodwinds, playful bass, and a cheeky musical rhythm."],
      ["Deadpan Humour", "A restrained comedic score with minimal piano, subtle bass, and tiny unexpected musical accents enhancing dry humour."],
      ["Comic Confusion", "A quirky score with alternating piano phrases, playful woodwinds, light percussion, and musical turns suggesting confusion."],
      ["Comedic Victory", "A cheerful score with bright brass, bouncing strings, playful percussion, and an exaggerated triumphant flourish."],
    ],
  },
  {
    title: "Fantasy & Magic",
    entries: [
      ["Epic Fantasy", "An epic fantasy orchestral score with sweeping strings, majestic brass, mystical woodwinds, powerful percussion, and magical adventure."],
      ["Magical Discovery", "A magical score with shimmering bells, delicate harp, airy strings, and sparkling orchestral textures conveying wonder."],
      ["Enchanted Forest", "A mystical score with soft woodwinds, gentle harp, shimmering strings, and dreamy atmospheric layers."],
      ["Fairy Tale", "A whimsical orchestral score with lyrical strings, delicate bells, playful woodwinds, and a storybook sense of wonder."],
      ["Dark Fantasy", "A dark fantasy score with low brass, ominous strings, deep percussion, and mysterious atmospheric textures."],
      ["Wizard", "A magical score with swirling strings, shimmering chimes, mysterious woodwinds, and subtle orchestral crescendos."],
      ["Spell Casting", "A mystical score with delicate bells, rising string textures, airy choir, and a gradual magical crescendo."],
      ["Dragon Arrival", "A powerful fantasy score with bold brass, deep drums, sweeping strings, and an imposing dramatic rise."],
      ["Quest Begins", "An uplifting fantasy adventure score with bright brass, rhythmic strings, woodwinds, and a sense of heroic possibility."],
      ["Ancient Kingdom", "A majestic orchestral score with regal brass, sweeping strings, ceremonial percussion, and grand fantasy atmosphere."],
      ["Magical Transformation", "A shimmering score with rising harp glissandos, sparkling bells, swelling strings, and a wondrous musical reveal."],
      ["Fantasy Battle", "An epic orchestral score with powerful drums, aggressive brass, driving strings, and heroic cinematic momentum."],
      ["Fairy Magic", "A delicate magical score with celesta, harp, soft strings, and sparkling whimsical musical textures."],
      ["Legendary Hero", "A heroic fantasy score with soaring brass, powerful strings, deep percussion, and a majestic melody."],
    ],
  },
  {
    title: "Sci-Fi & Futuristic",
    entries: [
      ["Futuristic Atmosphere", "A futuristic score with ambient synthesizers, deep electronic drones, delicate pulsing textures, and spacious atmosphere."],
      ["Technology", "A sleek electronic score with rhythmic digital pulses, subtle synthesizer arpeggios, deep bass, and modern futuristic mood."],
      ["AI Awakening", "A mysterious futuristic score with evolving synthesizer textures, delicate electronic pulses, ethereal tones, and building intensity."],
      ["Space Exploration", "An expansive space score with ethereal synthesizers, sweeping orchestral strings, deep ambient drones, and wonder."],
      ["Cyberpunk", "A dark electronic score with pulsing synth bass, atmospheric pads, rhythmic electronic percussion, and neon cyberpunk atmosphere."],
      ["Futuristic Mystery", "A mysterious electronic score with digital pulses, dark ambient synthesizers, sparse piano, and evolving textures."],
      ["Sci-Fi Danger", "A tense futuristic score with deep electronic bass pulses, dissonant synthesizers, rhythmic percussion, and intensifying suspense."],
      ["Time Travel", "A surreal score with shimmering synthesizers, mysterious piano, reversed textures, and evolving layers suggesting time shifting."],
      ["Alien Encounter", "An atmospheric score with unusual synthesizer tones, deep drones, sparse metallic textures, and a sense of otherworldly discovery."],
      ["Robotics", "A rhythmic electronic score with precise pulsing synths, mechanical percussion, deep bass, and sleek technological atmosphere."],
      ["Space Station", "A restrained ambient score with soft synthesizer pads, distant pulses, delicate tonal textures, and quiet futuristic mood."],
      ["Futuristic Chase", "An energetic electronic action score with driving synth bass, rapid percussion, rhythmic pulses, and escalating urgency."],
    ],
  },
  {
    title: "Documentary & Realism",
    entries: [
      ["Documentary Neutral", "A restrained documentary score with soft piano, subtle ambient textures, gentle strings, and unobtrusive emotional warmth."],
      ["Nature Documentary", "A peaceful cinematic score with gentle strings, soft woodwinds, delicate piano, and an expansive sense of natural beauty."],
      ["Historical Documentary", "A reflective orchestral score with warm strings, restrained brass, gentle percussion, and a dignified historical atmosphere."],
      ["Investigative Documentary", "A subtle investigative score with low piano, restrained pulses, soft strings, and a thoughtful sense of inquiry."],
      ["Human Story", "An emotional documentary score with delicate piano, warm cello, soft strings, and a compassionate understated mood."],
      ["Discovery", "An uplifting documentary score with gentle orchestral movement, warm piano, light percussion, and a sense of curiosity."],
      ["Scientific Wonder", "A modern ambient score with soft synthesizers, delicate piano, subtle rhythmic pulses, and a thoughtful atmosphere of discovery."],
      ["Technology Documentary", "A clean contemporary score with subtle electronic pulses, ambient synthesizers, restrained percussion, and a polished informative mood."],
      ["Travel Documentary", "An uplifting score with acoustic guitar, gentle strings, warm percussion, and an open adventurous atmosphere."],
      ["Social Issue", "A restrained serious score with low piano, soft strings, atmospheric textures, and thoughtful emotional weight."],
      ["Documentary Tension", "A subtle cinematic score with deep drones, gentle pulses, restrained strings, and gradually building investigative tension."],
      ["Documentary Conclusion", "A warm reflective score with gentle piano, swelling strings, and a calm uplifting resolution."],
    ],
  },
  {
    title: "Emotional & Inspirational",
    entries: [
      ["Inspiration", "An inspiring cinematic score with warm piano, uplifting strings, gentle percussion, and a gradually rising melody expressing determination."],
      ["Overcoming Obstacles", "A motivational score with steady percussion, determined piano, powerful strings, and a gradual build toward triumph."],
      ["Personal Growth", "An uplifting score with gentle piano, warm acoustic textures, soft strings, and hopeful melody expressing transformation."],
      ["Courage", "A heroic score with bold brass, powerful strings, steady percussion, and a rising melody expressing bravery."],
      ["Redemption", "An emotional score with reflective piano, warm cello, slowly swelling strings, and a hopeful orchestral resolution."],
      ["Inspirational Finale", "A grand cinematic finale with sweeping strings, soaring brass, powerful percussion, and an uplifting emotional crescendo."],
      ["Success", "A bright triumphant score with uplifting piano, celebratory strings, powerful brass, and a confident victorious melody."],
      ["Resilience", "A determined emotional score with rhythmic piano, warm strings, subtle percussion, and a gradual rise from struggle to strength."],
      ["Kindness", "A gentle heartwarming score with soft piano, delicate strings, warm woodwinds, and a tender uplifting melody."],
      ["Community", "A hopeful orchestral score with warm strings, gentle piano, light percussion, and a welcoming sense of togetherness."],
      ["Quiet Triumph", "A restrained uplifting score with gentle piano, soft sustained strings, and a subtle emotional rise celebrating a personal victory."],
      ["New Beginning", "A hopeful cinematic score with delicate piano, warm strings, airy textures, and a gradually brightening melody."],
      ["Faith and Reflection", "A reverent cinematic score with soft piano, gentle strings, subtle choir-like textures, and peaceful contemplative warmth."],
      ["Purpose", "An inspiring score with steady rhythmic movement, warm orchestral layers, uplifting piano, and a sense of meaningful forward motion."],
    ],
  },
  {
    title: "Cinematic Atmosphere & Transitions",
    entries: [
      ["Establishing Shot", "A cinematic atmospheric score with soft ambient strings, gentle piano, spacious textures, and a subtle emotional tone establishing the setting."],
      ["Beautiful Landscape", "A peaceful score with sweeping strings, gentle piano, soft woodwinds, and an expansive uplifting melody conveying beauty."],
      ["Lonely Character", "A minimalist score with isolated piano notes, soft atmospheric drones, delicate strings, and reflective loneliness."],
      ["Time Passing", "A gentle score with repeating piano patterns, soft ticking percussion, subtle strings, and evolving textures suggesting time passing."],
      ["Flashback", "A nostalgic score with warm piano, gentle strings, soft ambient textures, and dreamy emotional quality suggesting memories."],
      ["Dramatic Transition", "A cinematic transition score with a rising orchestral swell, deep atmospheric tones, subtle percussion, and a crescendo."],
      ["Scene Ending", "A cinematic closing score with a gentle orchestral swell, emotional piano, sustained strings, and a soft natural fade."],
      ["Dramatic Pause", "A minimal score with a sustained low atmospheric tone, sparse piano notes, and subtle tension during a dramatic pause."],
      ["Final Reveal", "A cinematic revelation score with a suspenseful buildup, powerful orchestral impact, swelling strings, and dramatic resolution."],
      ["Montage", "A cinematic montage score with steady rhythmic pulses, flowing strings, warm piano, and gradually building emotional momentum."],
      ["Dream Sequence", "A dreamy score with soft synthesizer pads, delicate piano, airy strings, and floating atmospheric textures."],
      ["Opening Credits", "A cinematic theme with memorable piano motifs, layered orchestral strings, subtle percussion, and a polished dramatic introduction."],
    ],
  },
  {
    title: "Jazz, Noir & Period Styles",
    entries: [
      ["Noir Jazz", "A moody jazz score with muted trumpet, brushed drums, upright bass, sparse piano, and smoky late-night atmosphere."],
      ["Vintage Mystery", "A retro mystery score with piano, muted brass, pizzicato strings, upright bass, and playful detective-style rhythm."],
      ["Elegant Lounge", "A sophisticated lounge score with mellow piano, soft brushed percussion, warm bass, and understated jazz textures."],
      ["Old Hollywood Romance", "A lush orchestral score with sweeping strings, elegant piano, warm woodwinds, and classic romantic film atmosphere."],
      ["1920s Jazz", "A lively vintage jazz score with clarinet, piano, upright bass, brushed drums, and playful period-inspired rhythm."],
      ["Retro Suspense", "A vintage cinematic suspense score with tremolo strings, muted brass, low piano, and dramatic old-film atmosphere."],
      ["Western", "A cinematic western score with acoustic guitar, restrained strings, warm brass, and spacious adventurous atmosphere."],
      ["Period Drama", "An elegant period score with lyrical strings, delicate piano, chamber orchestration, and refined emotional warmth."],
    ],
  },
  {
    title: "Sports, Competition & Achievement",
    entries: [
      ["Training Montage", "A motivational cinematic score with steady drums, rhythmic strings, energetic piano, and a gradual rise in determination."],
      ["Competition", "An energetic score with driving percussion, rhythmic orchestral strings, bold brass, and exciting forward momentum."],
      ["Underdog", "An inspiring score with reflective piano, gradually building strings, steady percussion, and a triumphant emotional rise."],
      ["Winning Moment", "A triumphant score with soaring brass, powerful orchestral strings, celebratory percussion, and a bold victory melody."],
      ["Near Defeat", "A tense emotional score with low strings, restrained percussion, subtle piano, and slowly building determination."],
      ["Personal Record", "An uplifting score with rhythmic piano, bright strings, energetic percussion, and a confident celebratory crescendo."],
    ],
  },
  {
    title: "South African Styles",
    entries: [
      ["Amapiano After Hours", "A mellow instrumental amapiano cue with soft jazz chords, a spacious log-drum groove, restrained shakers, and a warm late-night pocket."],
      ["Cape Jazz Reflection", "A laid-back Cape jazz instrumental with brushed drums, warm keys, melodic bass, and a restrained saxophone response between lines of dialogue."],
      ["Cape Goema Celebration", "A bright goema-inspired score with lilting syncopated percussion and short brass phrases. Build into the celebration and settle before the next spoken line."],
      ["Maskandi Road Ahead", "A lightly arranged maskandi-inspired instrumental with fingerpicked acoustic guitar, a steady bass pulse, and short concertina accents for a reflective journey."],
      ["Mbaqanga Family Gathering", "An upbeat mbaqanga-inspired instrumental with interlocking clean guitars, a round bass line, and light percussion that supports the warmth of a family gathering."],
      ["Gqom Night Pursuit", "A sparse gqom-inspired instrumental with broken kick patterns, dark bass, and short percussive hits that tighten as the pursuit picks up."],
    ],
  },
  {
    title: "Dialogue & Quiet Scenes",
    entries: [
      ["No Background Music", "N/A"],
      ["Single Note Under Tension", "One quiet sustained cello note sits below the conversation, then fades as the speaker finishes."],
      ["Space for the Confession", "Leave the first line of the confession unscored. Bring in a soft piano chord at the listener’s reaction and let it decay naturally."],
      ["Warm Room Underscore", "A barely audible warm sustained chord supports the dialogue with gentle harmonic movement, soft dynamics, and no percussion."],
      ["Quiet Scene Handoff", "Keep the scene unscored until the final beat. Introduce a soft instrumental motif that can continue into the next scene."],
    ],
  },
  {
    title: musicModifierGroup,
    entries: [
      ["Quiet Start", "The music begins very softly and remains subtle beneath the scene."],
      ["Gradual Build", "The music gradually builds in intensity throughout the scene."],
      ["Big Climax", "The music reaches a powerful emotional crescendo at the climax."],
      ["Sudden Tension", "The music abruptly intensifies at the critical moment."],
      ["Subtle Background", "Keep the music restrained, atmospheric, and unobtrusive."],
      ["Emotional Ending", "The music resolves into a gentle emotional ending and fades naturally."],
      ["Cliffhanger Ending", "End with an unresolved suspenseful musical note."],
      ["Dialogue-Friendly", "Keep the music low in the mix, allowing dialogue to remain clearly audible."],
      ["Balanced Mix", "Maintain balanced cinematic music that never overwhelms dialogue or sound effects."],
      ["Smooth Transition", "The music transitions smoothly with the changing mood of the scene."],
      ["Short Sting", "Use a brief, memorable orchestral accent, then let the music fall away."],
      ["Fade In", "Let the music fade in gradually rather than starting abruptly."],
      ["Fade Out", "Let the score fade naturally at the end of the scene."],
      ["Pulse Under Dialogue", "Maintain a quiet rhythmic pulse beneath dialogue to preserve tension without distracting."],
      ["Dynamic Contrast", "Use a quiet musical passage followed by a stronger swell to create cinematic contrast."],
      ["Dialogue Ducking", "Dip the score gently under each spoken line, then bring it back up between lines. Keep the speech clear."],
      ["Instrumental Only", "Use instrumental music throughout. Keep lead vocals, lyrics, and prominent vocal samples out of the score."],
      ["Carry the Motif", "Carry the existing melodic motif and instrumentation through the next scene at the same tempo so the transition feels continuous."],
      ["Hold Until the Reveal", "Keep the opening clear of music. Fade in the score once the reveal lands, leaving space for the first reaction."],
      ["End on a Clean Cut", "Resolve the cue on a clear final beat and cut cleanly at the scene transition."],
    ],
  },
]
