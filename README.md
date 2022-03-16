# mixxx_numark_mixtrack_platinum_fx

Copy a lot of the manual from https://manual.mixxx.org/2.3/en/hardware/controllers/numark_mixtrack_pro_fx.html
Just updated where we have made changes / additions

## Changes (from Octopussy gist)

### xml

Changed author and file names to me (QGazQ), this is to allow side by side loading and compare.
If this were to be submitted they should be removed.

Added effect parameter callback bindings 4 more times so we have 1 per effect (see below for use)

Added Cue button, and Pitch Bend buttons for decks 3 and 4

Added outputs for keylock (copied from Mixtrack Platinum mapping)

Correct shift sample button relase for channels 3 and 4

### js

Changed 3rd pitch range to +/50 to match Serato (+/-100 seems too much)

Made the pitch range and rate display (based on Alephic's implementaion, but fixed some odd decimals on the main mixxx display)

Changed the deck switch logic to ignore the "release" since this is triggered both by the "old" deck being switched away from (which is what the code wanted) but also by the button being released.
This ment that we thought neither deck was active most of the time.
Instead when a deck comes active, we assume the "alt" one isn't.

Changed the browse button to have acceleration, and by default shift now increases the acceleration a lot (to match the description in the manual)
Holding left shift while pressing browse does "GoToItem" which opens a folder in the left pannel, and loads the track to an empty deck on the right.
Holding right shift while pressing loads the track into the preview deck and plays it (or stops it if its already playing)

Added up down arrows for bpm matching
Added caching to this so they are only sent to the decks if they have changed (or start up and deck switch)

Made shutdown zero the digits (and turn process to 0, decks back to 1 and 2, and generally try and make it look tidy)

Shift PFL(Cue) is slip mode toggle.

Shift load button ejects the deck.  I wanted to make it previous track since we lost it from the bottom row of the performance pads, but mixxx doesn't seem to have a previous track control.

Some tidy up of initialisation:
* we force the decks back to deck 1 and 2 to match our variables
* send a keylock update.
* disable effects on master and headphones

Fixed visual error for shift play, when aligning the beatgrid the button never went off

Changed default high light to 0x7f (full on, 0x0a would do as well, but 0x09 is one down).  Not much uses this var.

Default to only 4 fader cuts

Make Samples light half brightness when loaded and full brightness while playing

Make shift and gue gain change all 16 samplers pregain

#### Padmodes

The pad mode buttons have 3 different states.

| State | Active | LED |
| --- | --- | --- |
| Normal | Single press the button | On |
| Shifted | Shift press the button | Slow Blink |
| Alternative | Either, press and hold for 550ms (0.5s), or double press | Fast Blink |

Performance Pads in each mode:

| Mode | Normal | Shifted | Alternative |
| --- | --- | --- | --- |
| Cue | Cues 1-8 (1) | Cues 9-16 (1) | Beatjump (2) |
| Auto Loop | Loops (3) | Roll (4) | Cue loop (10) |
| Fader Cuts | Top 4 Faders cut (5), Bottom 4 as labelled (6) | All 8 Fader cut (5) | Top 4 Faders cut (5), Bottom 4 (7) |
| Sample | Samples 1-8 (8) | Samples 9-16 (8) | Pitch Play (9) |

1) Normal cue behaviour, press triggers or sets if empty.  Shift press clears.
2) Normal jump by (insert jump table).  Shift press reverse jump.
3) Normal, Start a loop of lenght (insert table here).  Shift press do a roll loop of the same length.
4) Same as Loops (3) but shift state inverted (default roll, shift loop).
5) Auto moves the fade, ref manual.
6) Stutter does stutter, Prev does jump to start, Rewind scrub back, FF scrub forward.
7) Stutter does censor (reverse roll), Prev does play reverse (toggle), Rewind does key sync to other deck - shift does key reset, FF does tap tempo as TAP button (but clearly this deck) - shift does tempo reset
8) Normal sample behaviour, press plays (or loads if empty).  Shift press stops if its playing, if not then ejects.
9) See https://serato.com/latest/blog/20208/update-196-pitch-play-mappings Only differences are the ranges aren't change by a parameter button they are changed by Shift Sample (which means you can't get directly from Pitch Play to Samples 9-16), and the "root" key is half brightness.  https://serato.com/downloads/files/151805/Numark+MixTrack+Platinum+FX+Serato+DJ+Pro+Quick-Start+Guide.pdf
10) Currently cue loop, but see below.  Pressing the button jumps to the relative hotcue (1-8) and activates a loop (the same length as if the loop button was pressed).  Shift pressing a button activates slip mode, and does a roll at the cue point, then releasing the button resumes where it would have been, I'm not sure how reliable this is, but it seems neet!
* Cue loop - Probably not as Mixxx 2.4 will introduce saved loops, which will just go in the normal cues that we have 16 of anyway.
* Slicer - Nice if we can implement (might be too much!), consider stealing from https://manual.mixxx.org/2.4/de/hardware/controllers/pioneer_ddj_sx.html#pioneer-ddj-sx-slicermode (though might need 2.4) also https://mixxx.discourse.group/t/hercules-djcontrol-inpulse-500/19739/51  FUTURE!

#### Tapping

Added logic for the tap button, Two modes exist:
* The default is to use the mixxx common bpm.tapButton which sets the effective bpm to the one tapped using the tempo adjust.  Shift tap resets to 0 tempo change.
* The alternative changes the actual file bpm.  The problem is the reset doesn't work, the best I can do is change the effective bpm to the original, but then the file is still "broken" next time it is loaded.
The alternative mode is only accessible by setting a code variable MixtrackPlatinumFX.tapChangesTempo to false, recommended only for advanced users

For the default, the mixxx common function takes taps and averages them.
If you don't tap for 2 seconds the average resets and you start again.
To prevent accidental double taps or misses if a tap is 40% shorter or 80% longer it will be ignored.
I found while testing sometimes if I got the first two taps wrong the rest would be rejected by the filter, but it wasn't obvious this was happening.
By default the button is dimly lit (like most others). When you tap the button if it accepts the tap it will go bright, if it rejects it from the filter it will show off.
If this happens stop tapping wait 2 seconds for the filter to clear and try again.
Fixed this kicking in after 8 taps.

For tapping we have to "guess" which deck is intended, so we use some pointers.
1) we'll only consider loaded decks
2) except in fallback we'll only consider decks on the "active" layer (unless neither on this layer are loaded)
3) If one deck has PFL and the other doesn't we use that one (assumption that tapping bpm will be on a non playout deck)
4) If both have the same PFL state then look if one is playing.  Currently prefers the one that IS playing, could argue this the other way?
5) If they both match then use the one with the lowest deck number

To help know which it is using when tapping BOTH up and down arrows on the deck are lit.  As the first tap doesn't make any changes (you can't work out a bpm from one tap) it is safe to tap and hold the button and check which deck the arrows are showing on.

#### Effects

I've changed the way these work from all the other implementaions, to how I think I want them.
I haven't really use it much yet only while implementing, so may not be great.

Fx rockers (the Hold, Off, On things) turn on Fx1 and Fx2 chains for the current active deck (left Desk 1 or 3, Right Deck 2 or 4).

6 Fx selectors turn on and off the 6 effects (3 in Fx1 and 3 in Fx2).  Fill these are you wish, I've got them as Bitcrusher (rather then HPF), Autopan (rather than LPF), Flanger, Echo, Reverb, Phaser (the last 4 match the buttons).
Shift press toggles them on an off so you can have multiple effects active.  Normal press turns off all effects except this one, to allow quick selection of a single effect.

Dry/Wet knob as before contols both effects banks.
Beats knob controls parameter 1 for all 6 effects (normally time based)
Shift Beats knob contols the meta knobs for all 6 effects.

Made the 6 FX selectors blink when either of the FX paddles in engaged (either hold or on), and synced with pad mode blinking