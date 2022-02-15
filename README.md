# mixxx_numark_mixtrack_platinum_fx

## Changes (from Octopussy gist)

### xml

Changed author and file names to me (QGazQ), this is to allow side by side loading and compare.
If this were to be submitted they should be removed.

Added effect parameter callback bindings 4 more times so we have 1 per effect (see below for use)

Added Cue button, and Pitch Bend buttons for decks 3 and 4

Added outputs for keylock (copied from Mixtrack Platinum mapping)

### js

Changed 3rd pitch range to +/50 to match Serato (+/-100 seems too much)

Made the pitch range and rate display (based on Alephic's implementaion, but fixed some odd decimals on the main mixxx display)

Changed the deck switch logic to ignore the "release" since this is triggered both by the "old" deck being switched away from (which is what the code wanted) but also by the button being released.
This ment that we thought neither deck was active most of the time.
Instead when a deck comes active, we assume the "alt" one isn't.

#### Effects

I've changed the way these work from all the other implementaions, to how I think I want them.
I haven't really use it much yet only while implementing, so may not be great.

Fx rockers (the Hold, Off, On things) turn on Fx1 and Fx2 chains for the current active deck (left Desk 1 or 3, Right Deck 2 or 4).

6 Fx selectors turn on and off the 6 effects (3 in Fx1 and 3 in Fx2).  Fill these are you wish, I've got them as Bitcrusher (rather then HPF), Autopan (rather than LPF), Flanger, Echo, Reverb, Phaser (the last 4 match the buttons).
Shift press toggles them on an off so you can have multiple effects active.  Normal press turns off all effects except this one, to allow quick selection of a single effect.

Dry/Wet knob as before contols both effects banks.
Beats knob contols the meta knobs for all 6 effects.
Shift beats knob controls parameter 1 for all 6 effects.
