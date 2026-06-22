// =============================================================================
// data/trivia.js — Event-space TRIVIA (replaces the dice-roll event deck).
// Land on an Event hex -> draw a question. Correct = bonus HC (by difficulty),
// wrong = nothing (no penalty). The 'sauce' reveal shows either way.
// =============================================================================

export const TRIVIA_QUESTIONS = [
  {
    "id": "blues_01",
    "difficulty": "easy",
    "era": "Blues & Early Jazz (1920s–40s)",
    "topic": "legend",
    "question": "According to legend, where did blues guitarist Robert Johnson supposedly sell his soul to the devil in exchange for his talent?",
    "options": [
      "On a Mississippi riverboat",
      "At a crossroads at midnight",
      "In a New Orleans church",
      "In a Chicago studio"
    ],
    "answer": 1,
    "sauce": "He died at 27 in 1938 — one story says a jealous husband poisoned his whiskey. The crossroads myth basically invented the 'deal with the devil' rock trope."
  },
  {
    "id": "blues_02",
    "difficulty": "medium",
    "era": "Blues",
    "topic": "theory",
    "question": "Medieval church authorities reportedly shunned one musical interval, nicknaming it 'the Devil in music' (diabolus in musica). Which one?",
    "options": [
      "The perfect fifth",
      "The octave",
      "The tritone",
      "The major third"
    ],
    "answer": 2,
    "sauce": "That dissonant tritone later became the backbone of blues, jazz and metal — yes, the same 'Devil's Interval' your game already rewards."
  },
  {
    "id": "blues_03",
    "difficulty": "medium",
    "era": "Blues",
    "topic": "artists",
    "question": "Which singer was crowned the 'Empress of the Blues' in the 1920s?",
    "options": [
      "Billie Holiday",
      "Ella Fitzgerald",
      "Ma Rainey",
      "Bessie Smith"
    ],
    "answer": 3,
    "sauce": "The highest-paid Black entertainer of the 1920s — and by one account she once single-handedly chased off a gang of Klansmen messing with her tent show."
  },
  {
    "id": "blues_04",
    "difficulty": "easy",
    "era": "Blues",
    "topic": "nicknames",
    "question": "Jazz legend Louis Armstrong's nickname 'Satchmo' was short for what?",
    "options": [
      "Satchel Mouth",
      "Scat Master",
      "Satin Smooth",
      "Saturday Mojo"
    ],
    "answer": 0,
    "sauce": "A British editor allegedly misheard an older nickname, 'Satchelmouth,' and 'Satchmo' stuck for the rest of his life."
  },
  {
    "id": "blues_05",
    "difficulty": "hard",
    "era": "Blues",
    "topic": "protest",
    "question": "Billie Holiday's haunting 1939 song 'Strange Fruit' was a protest against what?",
    "options": [
      "Prohibition",
      "Lynching in the American South",
      "The Great Depression",
      "Segregated theaters"
    ],
    "answer": 1,
    "sauce": "Her label refused to record it, so she cut it for a tiny indie. She closed every show with it — lights down, no encore."
  },
  {
    "id": "blues_06",
    "difficulty": "medium",
    "era": "Blues",
    "topic": "performance",
    "question": "Cab Calloway's 1931 hit 'Minnie the Moocher' helped popularize which vocal style ('hi-de-ho')?",
    "options": [
      "Yodeling",
      "Beatboxing",
      "Scat singing",
      "Falsetto"
    ],
    "answer": 2,
    "sauce": "Story goes he forgot the words live on radio, improvised nonsense syllables, and had the whole crowd chanting them back."
  },
  {
    "id": "blues_07",
    "difficulty": "hard",
    "era": "Blues",
    "topic": "etymology",
    "question": "In early 1900s slang, the word 'jazz' originally carried what kind of connotation?",
    "options": [
      "Military",
      "Religious",
      "Culinary",
      "Sexual / vulgar"
    ],
    "answer": 3,
    "sauce": "Many early players found the term so crude they resisted being labeled with it for years."
  },
  {
    "id": "rnr_01",
    "difficulty": "medium",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "censorship",
    "question": "Little Richard's 1955 smash 'Tutti Frutti' had its lyrics rewritten before release because they were too what?",
    "options": [
      "Sexually explicit",
      "Political",
      "Religious",
      "Violent"
    ],
    "answer": 0,
    "sauce": "The original was a raunchy ode to a certain 'good booty.' A songwriter sanitized it in about 15 minutes over lunch."
  },
  {
    "id": "rnr_02",
    "difficulty": "medium",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "origins",
    "question": "Elvis Presley's 'Hound Dog' was originally a hit three years earlier for which artist?",
    "options": [
      "Etta James",
      "Ruth Brown",
      "Big Mama Thornton",
      "LaVern Baker"
    ],
    "answer": 2,
    "sauce": "Her version topped the R&B chart in 1953. Elvis actually copied a Vegas lounge act's cover — not the original."
  },
  {
    "id": "rnr_03",
    "difficulty": "hard",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "scandal",
    "question": "Rock pioneer Jerry Lee Lewis torpedoed his own career in 1958 when the press learned he had married his ___.",
    "options": [
      "manager's daughter",
      "13-year-old cousin",
      "best friend's wife",
      "record producer"
    ],
    "answer": 1,
    "sauce": "A British tour collapsed within days and radio blacklisted him. It took a decade to claw back — as a country star."
  },
  {
    "id": "rnr_04",
    "difficulty": "medium",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "myth",
    "question": "Despite the prison songs and outlaw image, how much real prison time did Johnny Cash actually serve?",
    "options": [
      "Essentially none — a night or two in jail",
      "Four years",
      "Eighteen months",
      "He was never even arrested"
    ],
    "answer": 0,
    "sauce": "A handful of overnight arrests, but no real sentence. The outlaw legend was largely... a really good image."
  },
  {
    "id": "rnr_05",
    "difficulty": "easy",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "performance",
    "question": "Which rock 'n' roll founder is famous for the 'duck walk' across the stage?",
    "options": [
      "Buddy Holly",
      "Bo Diddley",
      "Carl Perkins",
      "Chuck Berry"
    ],
    "answer": 3,
    "sauce": "He claimed he first did it as a kid to hide wrinkles in his rumpled suit — then kept it because crowds went nuts."
  },
  {
    "id": "rnr_06",
    "difficulty": "medium",
    "era": "Rock 'n' Roll (1950s)",
    "topic": "tragedy",
    "question": "The 1959 plane crash that killed Buddy Holly, Ritchie Valens and The Big Bopper became known as ___.",
    "options": [
      "'The Day the Music Died'",
      "'Black Tuesday'",
      "'The Final Encore'",
      "'The Silent Spring'"
    ],
    "answer": 0,
    "sauce": "Valens won his seat on the doomed plane with a coin toss. Don McLean's 'American Pie' coined the phrase 12 years later."
  },
  {
    "id": "60s_01",
    "difficulty": "medium",
    "era": "The 1960s",
    "topic": "songwriting",
    "question": "Keith Richards says he came up with the '(I Can't Get No) Satisfaction' riff how?",
    "options": [
      "On a napkin at breakfast",
      "In his sleep — he taped it overnight",
      "During a sound check by accident",
      "In a dream about Chuck Berry"
    ],
    "answer": 1,
    "sauce": "He found his tape recorder running in the morning: 30 seconds of the riff, then 40 minutes of snoring."
  },
  {
    "id": "60s_02",
    "difficulty": "easy",
    "era": "The 1960s",
    "topic": "meaning",
    "question": "John Lennon always insisted 'Lucy in the Sky with Diamonds' was NOT about LSD, but inspired by what?",
    "options": [
      "A Lewis Carroll book",
      "His son's nursery drawing",
      "A dream about Yoko",
      "A diamond advert"
    ],
    "answer": 1,
    "sauce": "His son Julian drew a classmate, Lucy, 'in the sky with diamonds.' The L-S-D initials? Lennon swore it was coincidence."
  },
  {
    "id": "60s_03",
    "difficulty": "hard",
    "era": "The 1960s",
    "topic": "scandal",
    "question": "The FBI spent over two years investigating The Kingsmen's 'Louie Louie' (1963) for what?",
    "options": [
      "Communist messaging",
      "Copyright theft",
      "Allegedly obscene lyrics",
      "Tax fraud"
    ],
    "answer": 2,
    "sauce": "They concluded the lyrics were 'unintelligible at any speed' and gave up. The singer just mumbled."
  },
  {
    "id": "60s_04",
    "difficulty": "easy",
    "era": "The 1960s",
    "topic": "performance",
    "question": "At the 1967 Monterey Pop Festival, Jimi Hendrix ended his set by doing what to his guitar?",
    "options": [
      "Setting it on fire",
      "Throwing it into the sea",
      "Giving it to a fan",
      "Restringing it live"
    ],
    "answer": 0,
    "sauce": "He knelt, doused it in lighter fluid, and lit it like an altar offering. The photos made him an instant icon in America."
  },
  {
    "id": "60s_05",
    "difficulty": "hard",
    "era": "The 1960s",
    "topic": "behind-the-scenes",
    "question": "Motown's run of '60s hits was powered by an uncredited house band known as the ___.",
    "options": [
      "Wrecking Crew",
      "Swampers",
      "Funk Brothers",
      "Memphis Horns"
    ],
    "answer": 2,
    "sauce": "They're often said to have played on more #1 hits than the Beatles, Stones and Beach Boys combined — yet went unnamed for decades."
  },
  {
    "id": "60s_06",
    "difficulty": "medium",
    "era": "The 1960s",
    "topic": "studio",
    "question": "While writing his most ambitious music, Brian Wilson of the Beach Boys reportedly installed a piano where?",
    "options": [
      "In a swimming pool",
      "On the beach",
      "In a sandbox in his living room",
      "In a foam-lined booth"
    ],
    "answer": 2,
    "sauce": "He filled a box with sand to feel it between his toes as he composed. He also recorded with farm animals and bicycle bells."
  },
  {
    "id": "60s_07",
    "difficulty": "easy",
    "era": "The 1960s",
    "topic": "history",
    "question": "The Beatles' final public performance in 1969 took place where?",
    "options": [
      "Shea Stadium",
      "On their Apple HQ rooftop",
      "The Cavern Club",
      "Abbey Road crossing"
    ],
    "answer": 1,
    "sauce": "London police shut it down over noise complaints. It was the last time the four of them ever played live together."
  },
  {
    "id": "60s_08",
    "difficulty": "medium",
    "era": "The 1960s",
    "topic": "gear",
    "question": "The eerie flute sound opening The Beatles' 'Strawberry Fields Forever' came from an early tape-based keyboard called the ___.",
    "options": [
      "Theremin",
      "Moog",
      "Mellotron",
      "Hammond"
    ],
    "answer": 2,
    "sauce": "Each key triggered a strip of pre-recorded tape — a clunky analog 'sampler' decades before digital sampling existed."
  },
  {
    "id": "70s_01",
    "difficulty": "medium",
    "era": "The 1970s",
    "topic": "drama",
    "question": "Fleetwood Mac's 1977 mega-album 'Rumours' was recorded under what circumstances?",
    "options": [
      "In total silence",
      "While every couple in the band was breaking up",
      "In a haunted château",
      "In under 48 hours"
    ],
    "answer": 1,
    "sauce": "Two romances and a marriage were imploding at once. They wrote breakup songs about each other — then had to harmonize on them."
  },
  {
    "id": "70s_02",
    "difficulty": "easy",
    "era": "The 1970s",
    "topic": "panic",
    "question": "A late-'70s moral panic claimed Led Zeppelin's 'Stairway to Heaven' hid what if played backwards?",
    "options": [
      "Satanic messages",
      "Stock tips",
      "A secret recipe",
      "The band's addresses"
    ],
    "answer": 0,
    "sauce": "Robert Plant called it ridiculous. 'Backmasking' hysteria swept America regardless."
  },
  {
    "id": "70s_03",
    "difficulty": "hard",
    "era": "The 1970s",
    "topic": "history",
    "question": "What 1979 event at a Chicago ballpark became the symbol of the anti-disco backlash?",
    "options": [
      "The Studio 54 raid",
      "Disco Demolition Night",
      "The Bee Gees boycott",
      "The Saturday Night Fever riot"
    ],
    "answer": 1,
    "sauce": "A DJ blew up a crate of disco records between games; fans stormed the field and the second game was forfeited. Many saw an ugly undertone."
  },
  {
    "id": "70s_04",
    "difficulty": "medium",
    "era": "The 1970s",
    "topic": "myth",
    "question": "The Eagles' 'Hotel California' spawned wild rumors that it was secretly about what?",
    "options": [
      "A real haunted hotel",
      "Satanism / a cult",
      "A prison",
      "A mental institution"
    ],
    "answer": 1,
    "sauce": "The band said it was just a metaphor for excess and the dark side of the high life. The rumors only made it bigger."
  },
  {
    "id": "70s_05",
    "difficulty": "medium",
    "era": "The 1970s",
    "topic": "image",
    "question": "What was unusual about the band KISS's public image through the 1970s?",
    "options": [
      "They hid their real faces behind makeup for years",
      "They never spoke in interviews",
      "They played in total darkness",
      "They wore identical outfits"
    ],
    "answer": 0,
    "sauce": "They kept their bare faces a secret until 1983, when the 'unmasking' became a televised event."
  },
  {
    "id": "70s_06",
    "difficulty": "easy",
    "era": "The 1970s",
    "topic": "songcraft",
    "question": "Queen's 'Bohemian Rhapsody' (1975) broke pop convention by having no what?",
    "options": [
      "Drums",
      "Guitar",
      "Chorus",
      "Bridge"
    ],
    "answer": 2,
    "sauce": "A six-minute mash of ballad, opera and hard rock. Labels said radio would never touch a song that long — it became one of the biggest singles ever."
  },
  {
    "id": "70s_07",
    "difficulty": "medium",
    "era": "The 1970s",
    "topic": "artists",
    "question": "Which artist brought reggae to a global audience in the 1970s with songs of resistance and unity?",
    "options": [
      "Jimmy Cliff",
      "Peter Tosh",
      "Bob Marley",
      "Desmond Dekker"
    ],
    "answer": 2,
    "sauce": "He survived an assassination attempt in 1976 and performed two days later: 'The people trying to make this world worse aren't taking a day off. How can I?'"
  },
  {
    "id": "70s_08",
    "difficulty": "hard",
    "era": "The 1970s",
    "topic": "censorship",
    "question": "The Sex Pistols' 1977 single 'God Save the Queen' was banned by the BBC for what?",
    "options": [
      "Mocking the monarchy during the Queen's Jubilee",
      "Profanity",
      "Plagiarism",
      "Promoting drugs"
    ],
    "answer": 0,
    "sauce": "It reportedly outsold everything that week, but the official chart 'somehow' listed it at #2 to dodge a Jubilee embarrassment."
  },
  {
    "id": "80s_01",
    "difficulty": "easy",
    "era": "The 1980s",
    "topic": "history",
    "question": "When MTV launched on August 1, 1981, the first video it aired was, fittingly, ___.",
    "options": [
      "'Thriller'",
      "'Video Killed the Radio Star'",
      "'Billie Jean'",
      "'Take On Me'"
    ],
    "answer": 1,
    "sauce": "On-the-nose to the point of prophecy. Ironically MTV barely played Black artists at first — until 'Billie Jean' forced the door open."
  },
  {
    "id": "80s_02",
    "difficulty": "easy",
    "era": "The 1980s",
    "topic": "records",
    "question": "Michael Jackson's 'Thriller' (1982) holds which record?",
    "options": [
      "First digital album",
      "Best-selling album of all time",
      "First cassette-only album",
      "Longest album ever"
    ],
    "answer": 1,
    "sauce": "Estimates run past 70 million copies. Its 14-minute horror-movie video cost a then-insane half a million dollars."
  },
  {
    "id": "80s_03",
    "difficulty": "medium",
    "era": "The 1980s",
    "topic": "gear",
    "question": "The Roland TR-808 drum machine flopped on release, then went on to define which genres?",
    "options": [
      "Country and folk",
      "Bluegrass and jazz",
      "Hip-hop and electronic",
      "Opera and classical"
    ],
    "answer": 2,
    "sauce": "It sold poorly because the drums sounded 'fake.' Producers loved exactly that — its booming kick became hip-hop's heartbeat."
  },
  {
    "id": "80s_04",
    "difficulty": "hard",
    "era": "The 1980s",
    "topic": "scandal",
    "question": "The 'Parental Advisory: Explicit Content' sticker was created in 1985 after a campaign led by whom?",
    "options": [
      "The PMRC (incl. Tipper Gore)",
      "The FBI",
      "The record labels",
      "The Catholic Church"
    ],
    "answer": 0,
    "sauce": "They drew up a 'Filthy Fifteen' list of offending songs. The sticker became a badge of honor that arguably boosted sales."
  },
  {
    "id": "80s_05",
    "difficulty": "medium",
    "era": "The 1980s",
    "topic": "censorship",
    "question": "Frankie Goes to Hollywood's 1983 hit 'Relax' was banned by the BBC once a DJ realized it was about what?",
    "options": [
      "Sex",
      "Drugs",
      "Politics",
      "Religion"
    ],
    "answer": 0,
    "sauce": "The ban shot it straight to #1, where it parked for weeks. Nothing sells like forbidden."
  },
  {
    "id": "80s_06",
    "difficulty": "medium",
    "era": "The 1980s",
    "topic": "crossover",
    "question": "The 1986 collaboration that fused rap and rock was Run-DMC covering which band's song?",
    "options": [
      "Led Zeppelin",
      "Aerosmith ('Walk This Way')",
      "AC/DC",
      "The Rolling Stones"
    ],
    "answer": 1,
    "sauce": "Run-DMC initially thought the original was corny. The crossover revived Aerosmith's dead career and broke rap onto MTV."
  },
  {
    "id": "80s_07",
    "difficulty": "medium",
    "era": "The 1980s",
    "topic": "live",
    "question": "The 1985 Live Aid famine-relief concert is often said to have been stolen by whose set?",
    "options": [
      "U2's",
      "Queen's",
      "Led Zeppelin's",
      "Madonna's"
    ],
    "answer": 1,
    "sauce": "Freddie Mercury had all 72,000 of Wembley in his palm — frequently voted the greatest live performance in rock history."
  },
  {
    "id": "90s_01",
    "difficulty": "medium",
    "era": "The 1990s",
    "topic": "origins",
    "question": "Nirvana's 'Smells Like Teen Spirit' got its title from what?",
    "options": [
      "A poem",
      "A teen magazine",
      "A deodorant brand scrawled on Kurt's wall",
      "A perfume Courtney Love wore"
    ],
    "answer": 2,
    "sauce": "A friend wrote 'Kurt smells like Teen Spirit' as a joke about a girlfriend's deodorant. Cobain didn't even know it was a brand until after the song blew up."
  },
  {
    "id": "90s_02",
    "difficulty": "hard",
    "era": "The 1990s",
    "topic": "scandal",
    "question": "Pop duo Milli Vanilli were stripped of their 1990 Best New Artist Grammy after it emerged they had done what?",
    "options": [
      "Not sung a note on the album",
      "Stolen the melodies",
      "Faked their ages",
      "Plagiarized a rival"
    ],
    "answer": 0,
    "sauce": "The truth surfaced when their backing track skipped and looped live on MTV. It's still the only Grammy ever revoked."
  },
  {
    "id": "90s_03",
    "difficulty": "easy",
    "era": "The 1990s",
    "topic": "history",
    "question": "The mid-'90s 'East Coast vs. West Coast' hip-hop feud centered on which two artists, both later killed in unsolved shootings?",
    "options": [
      "Jay-Z and Nas",
      "Tupac and The Notorious B.I.G.",
      "Dr. Dre and Eazy-E",
      "Snoop and DMX"
    ],
    "answer": 1,
    "sauce": "Once friends, both were killed six months apart in 1996–97. Both cases remain officially unsolved."
  },
  {
    "id": "90s_04",
    "difficulty": "medium",
    "era": "The 1990s",
    "topic": "rivalry",
    "question": "The 1995 'Battle of Britpop' saw which two bands drop singles on the same day as a chart showdown?",
    "options": [
      "Pulp and Suede",
      "The Verve and Radiohead",
      "Blur and Oasis",
      "Spice Girls and Take That"
    ],
    "answer": 2,
    "sauce": "Blur won the battle (the #1 single); Oasis won the war (the bigger album and global fame)."
  },
  {
    "id": "90s_05",
    "difficulty": "medium",
    "era": "The 1990s",
    "topic": "gear",
    "question": "Cher's 1998 hit 'Believe' was the first major song to deliberately flaunt which now-everywhere studio effect?",
    "options": [
      "Reverb",
      "Auto-Tune",
      "Distortion",
      "The wah pedal"
    ],
    "answer": 1,
    "sauce": "Producers coyly called it 'a vocoder' to protect the trick. The robotic warble was 'the Cher effect' years before T-Pain made it a genre."
  },
  {
    "id": "90s_06",
    "difficulty": "hard",
    "era": "The 1990s",
    "topic": "business",
    "question": "The Wu-Tang Clan's contract was unusual because each member could do what?",
    "options": [
      "Sign solo deals with different labels",
      "Only record in Staten Island",
      "Never tour separately",
      "Use a single shared microphone"
    ],
    "answer": 0,
    "sauce": "Letting members sign individually elsewhere was a radical move that built a hip-hop empire across rival labels."
  },
  {
    "id": "00s_01",
    "difficulty": "medium",
    "era": "The 2000s",
    "topic": "industry",
    "question": "Which metal band became the public face of suing the file-sharing service Napster in 2000?",
    "options": [
      "Megadeth",
      "Metallica",
      "Slayer",
      "Iron Maiden"
    ],
    "answer": 1,
    "sauce": "Drummer Lars Ulrich personally hauled a list of 300,000 usernames to Napster's office. Fans turned on the band — but the suit reshaped the industry."
  },
  {
    "id": "00s_02",
    "difficulty": "hard",
    "era": "The 2000s",
    "topic": "sampling",
    "question": "Beyoncé's 2003 breakout 'Crazy in Love' is built on a horn sample from which group?",
    "options": [
      "The Temptations",
      "Earth, Wind & Fire",
      "The Chi-Lites",
      "The O'Jays"
    ],
    "answer": 2,
    "sauce": "Producer Rich Harrison flipped the Chi-Lites' 'Are You My Woman.' Beyoncé reportedly hated the track at first."
  },
  {
    "id": "00s_03",
    "difficulty": "medium",
    "era": "The 2000s",
    "topic": "moment",
    "question": "During a 2005 live Hurricane Katrina telethon, Kanye West went off-script to say what?",
    "options": [
      "'George Bush doesn't care about black people'",
      "'The government is lying'",
      "'Donate now or else'",
      "'This is bigger than music'"
    ],
    "answer": 0,
    "sauce": "Co-host Mike Myers froze beside him in real time. The unscripted line became one of the decade's defining TV moments."
  },
  {
    "id": "00s_04",
    "difficulty": "easy",
    "era": "The 2000s",
    "topic": "tech",
    "question": "Which 2003 launch fundamentally changed how people bought music?",
    "options": [
      "Spotify",
      "The iTunes Store (99¢ songs)",
      "YouTube",
      "SoundCloud"
    ],
    "answer": 1,
    "sauce": "Selling singles for 99 cents helped kill the album as the default unit — and gave the industry a legal answer to piracy."
  },
  {
    "id": "00s_05",
    "difficulty": "easy",
    "era": "The 2000s",
    "topic": "lyrics",
    "question": "OutKast's 2003 smash 'Hey Ya!' tells listeners to 'shake it like a ___.'",
    "options": [
      "tambourine",
      "rag doll",
      "Polaroid picture",
      "bottle of pop"
    ],
    "answer": 2,
    "sauce": "Polaroid itself reportedly had to remind people to STOP shaking their photos — it doesn't actually help them develop."
  },
  {
    "id": "10s_01",
    "difficulty": "easy",
    "era": "The 2010s–Now",
    "topic": "moment",
    "question": "At the 2009 MTV VMAs, Kanye West infamously interrupted whose acceptance speech?",
    "options": [
      "Beyoncé",
      "Lady Gaga",
      "Taylor Swift",
      "Katy Perry"
    ],
    "answer": 2,
    "sauce": "'Imma let you finish, but Beyoncé had one of the best videos of all time.' It launched a decade-long saga and a thousand memes."
  },
  {
    "id": "10s_02",
    "difficulty": "medium",
    "era": "The 2010s–Now",
    "topic": "records",
    "question": "Psy's 'Gangnam Style' (2012) made history as the first video to do what on YouTube?",
    "options": [
      "Hit 1 billion views",
      "Get demonetized",
      "Win a Grammy",
      "Get banned in the US"
    ],
    "answer": 0,
    "sauce": "It literally broke YouTube's view counter, which maxed out around 2.1 billion and had to be rebuilt to count higher."
  },
  {
    "id": "10s_03",
    "difficulty": "medium",
    "era": "The 2010s–Now",
    "topic": "industry",
    "question": "In December 2013, Beyoncé shocked the business by releasing her self-titled album how?",
    "options": [
      "As a free download",
      "With zero warning, overnight, fully finished with videos",
      "Only on vinyl",
      "One song per week"
    ],
    "answer": 1,
    "sauce": "No singles, no press, no announcement — it just appeared. The 'surprise drop' became a standard A-list move afterward."
  },
  {
    "id": "10s_04",
    "difficulty": "medium",
    "era": "The 2010s–Now",
    "topic": "controversy",
    "question": "Lil Nas X's 'Old Town Road' (2019) caused an uproar when Billboard removed it from which chart?",
    "options": [
      "The pop chart",
      "The R&B chart",
      "The country chart",
      "The dance chart"
    ],
    "answer": 2,
    "sauce": "Billboard said it wasn't 'country enough.' A Billy Ray Cyrus remix and a genre debate later, it sat at #1 for a record 19 weeks."
  },
  {
    "id": "10s_05",
    "difficulty": "easy",
    "era": "The 2010s–Now",
    "topic": "viral",
    "question": "In 2020, a viral TikTok of a man skateboarding while sipping cranberry juice sent which 1977 song back up the charts?",
    "options": [
      "Queen's 'Bohemian Rhapsody'",
      "The Eagles' 'Hotel California'",
      "Fleetwood Mac's 'Dreams'",
      "ABBA's 'Dancing Queen'"
    ],
    "answer": 2,
    "sauce": "Decades-old 'Dreams' re-entered the top 40. Band members and a juice brand joined the trend; the vibes were, officially, immaculate."
  },
  {
    "id": "10s_06",
    "difficulty": "medium",
    "era": "The 2010s–Now",
    "topic": "records",
    "question": "Billie Eilish's debut album, which swept the 2020 Grammys, was recorded mostly where?",
    "options": [
      "A Malibu mansion",
      "Her brother's small bedroom",
      "Abbey Road Studios",
      "A converted church"
    ],
    "answer": 1,
    "sauce": "She and brother Finneas made it in his childhood bedroom. At 18 she became the youngest to sweep the 'big four' Grammy categories."
  },
  {
    "id": "10s_07",
    "difficulty": "hard",
    "era": "The 2010s–Now",
    "topic": "industry",
    "question": "Around the mid-2010s, what overtook downloads and CDs as the music industry's biggest revenue source?",
    "options": [
      "Vinyl",
      "Streaming",
      "Ringtones",
      "Live concerts"
    ],
    "answer": 1,
    "sauce": "A single stream pays a sliver of a cent, reshaping how artists earn — and part of why songs got shorter and hookier."
  },
  {
    "id": "lore_01",
    "difficulty": "hard",
    "era": "Theory, Gear & Studio Lore",
    "topic": "sampling",
    "question": "The most-sampled drum break in history — the spine of jungle, drum 'n' bass and countless hip-hop tracks — is known as the ___.",
    "options": [
      "Funky Drummer",
      "Apache break",
      "Amen break",
      "Cold Sweat"
    ],
    "answer": 2,
    "sauce": "It's six seconds from The Winstons' 1969 B-side 'Amen, Brother.' The drummer was never paid for it and reportedly died with little money."
  },
  {
    "id": "lore_02",
    "difficulty": "easy",
    "era": "Theory, Gear & Studio Lore",
    "topic": "pop culture",
    "question": "Thanks to a famous SNL sketch, which Blue Öyster Cult song is forever linked to demands for 'more cowbell'?",
    "options": [
      "'(Don't Fear) The Reaper'",
      "'Burnin' for You'",
      "'Godzilla'",
      "'Cities on Flame'"
    ],
    "answer": 0,
    "sauce": "The cowbell really is on the record. Will Ferrell's sketch turned a tiny production quirk into immortal comedy."
  },
  {
    "id": "lore_03",
    "difficulty": "medium",
    "era": "Theory, Gear & Studio Lore",
    "topic": "myth",
    "question": "A stubborn urban legend claims Phil Collins's 'In the Air Tonight' is about him witnessing what?",
    "options": [
      "A bank robbery",
      "A man let someone drown",
      "A car crash he caused",
      "A murder at a gig"
    ],
    "answer": 1,
    "sauce": "Completely false — Collins has debunked it for decades. The drowning-revenge story is one of pop's most persistent myths."
  },
  {
    "id": "lore_04",
    "difficulty": "hard",
    "era": "Theory, Gear & Studio Lore",
    "topic": "tuning",
    "question": "Conspiracy theorists argue music should be tuned to 432 Hz instead of the modern standard of ___ Hz.",
    "options": [
      "440",
      "420",
      "444",
      "400"
    ],
    "answer": 0,
    "sauce": "The 440 Hz standard is real; claims that 432 is 'natural' or that 440 was a sinister plot are pseudoscience — but they thrive online."
  },
  {
    "id": "lore_05",
    "difficulty": "medium",
    "era": "Theory, Gear & Studio Lore",
    "topic": "studio",
    "question": "Which is TRUE of many classic recordings from the 1950s–60s?",
    "options": [
      "Entire hits were often cut live in one or two takes",
      "Vocals were always added last",
      "Drums were banned in studios",
      "Songs had to be under two minutes by law"
    ],
    "answer": 0,
    "sauce": "Studio time was money. Bands rehearsed hard and nailed legends in a single afternoon — Little Richard and Chuck Berry among them."
  },
  {
    "id": "lore_06",
    "difficulty": "easy",
    "era": "Theory, Gear & Studio Lore",
    "topic": "names",
    "question": "Before he was Bob Dylan, the folk icon was born under what name?",
    "options": [
      "Robert Allen",
      "Robert Zimmerman",
      "Bobby Dylan Thomas",
      "Robert Dean"
    ],
    "answer": 1,
    "sauce": "He reportedly took 'Dylan' as a nod to poet Dylan Thomas — then gave shifting, often invented stories about why."
  }
];

export const TRIVIA_BY_ID = Object.fromEntries(TRIVIA_QUESTIONS.map(q => [q.id, q]));

// Harmonic Charge granted for a correct answer, by difficulty.
export const TRIVIA_REWARD = { easy: 2, medium: 3, hard: 4 };

// AI opponents can't 'know' trivia — fair fixed odds of a correct answer, by difficulty.
export const TRIVIA_BOT_ODDS = { easy: 0.7, medium: 0.5, hard: 0.35 };
