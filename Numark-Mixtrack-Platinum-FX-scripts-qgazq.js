var MixtrackPlatinumFX = {};

// FX toggles
MixtrackPlatinumFX.toggleFXControlEnable = true;
MixtrackPlatinumFX.toggleFXControlSuper = false;

MixtrackPlatinumFX.shifBrowseIsZoom = false;

// pitch ranges
// add/remove/modify steps to your liking
// default step must be set in Mixxx settings
// setting is stored per deck in pitchRange.currentRangeIdx
MixtrackPlatinumFX.pitchRanges = [0.08, 0.16, 0.5];

MixtrackPlatinumFX.HIGH_LIGHT = 0x09;
MixtrackPlatinumFX.LOW_LIGHT = 0x01;

// whether the corresponding Mixxx option is enabled
// (Settings -> Preferences -> Waveforms -> Synchronize zoom level across all waveforms)
MixtrackPlatinumFX.waveformsSynced = true;

// jogwheel
MixtrackPlatinumFX.jogScratchSensitivity = 1024;
MixtrackPlatinumFX.jogScratchAlpha = 1; // do NOT set to 2 or higher
MixtrackPlatinumFX.jogScratchBeta = 1/32;
MixtrackPlatinumFX.jogPitchSensitivity = 10;
MixtrackPlatinumFX.jogSeekSensitivity = 10000;

// blink settings
MixtrackPlatinumFX.enableBlink = true;
MixtrackPlatinumFX.blinkDelay = 700;

// autoloop sizes, for available values see:
// https://manual.mixxx.org/2.3/en/chapters/appendix/mixxx_controls.html#control-[ChannelN]-beatloop_X_toggle
MixtrackPlatinumFX.autoLoopSizes = [
    "0.0625",
    "0.125",
    "0.25",
    "0.5",
    "1",
    "2",
    "4",
    "8"
];

// beatjump values, for available values see:
// https://manual.mixxx.org/2.3/en/chapters/appendix/mixxx_controls.html#control-[ChannelN]-beatjump_X_forward
// underscores (_) at the end are needed because numeric values (e.g. 8) have two underscores (e.g. beatjump_8_forward),
// but "beatjump_forward"/"beatjump_backward" have only one underscore
MixtrackPlatinumFX.beatJumpValues = [
    "0.0625_",
    "0.125_",
    "0.25_",
    "0.5_",
    "1_",
    "2_",
    "", // "beatjump_forward"/"beatjump_backward" - jump by the value selected in Mixxx GUI (4 by default)
    "8_"
];

// dim all lights when inactive instead of turning them off
components.Button.prototype.off = MixtrackPlatinumFX.LOW_LIGHT;

// pad modes control codes
MixtrackPlatinumFX.PadModeControls = {
    HOTCUE: 0x00,
    AUTOLOOP: 0x0D,
    FADERCUTS: 0x07,
    SAMPLE1: 0x0B,
    BEATJUMP: 0x02,
    SAMPLE2: 0x0F
};

// state variable, don't touch
MixtrackPlatinumFX.shifted = false;

MixtrackPlatinumFX.initComplete=false;

MixtrackPlatinumFX.init = function(id, debug) {     
    MixtrackPlatinumFX.id = id;
    MixtrackPlatinumFX.debug = debug;
    print("init MixtrackPlatinumFX " + id + " debug: " + debug);
    
    // disable demo lightshow
    var exitDemoSysex = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
    midi.sendSysexMsg(exitDemoSysex, exitDemoSysex.length);

    // enables 4 bottom pads "fader cuts"
    var faderCutSysex = [0xF0, 0x00, 0x20, 0x7F, 0x03, 0xF7];
    midi.sendSysexMsg(faderCutSysex, faderCutSysex.length);

    // initialize component containers
    MixtrackPlatinumFX.deck = new components.ComponentContainer();
    MixtrackPlatinumFX.effect = new components.ComponentContainer();
    var i;
    for (i = 0; i < 4; i++) {
        MixtrackPlatinumFX.deck[i] = new MixtrackPlatinumFX.Deck(i + 1);
        MixtrackPlatinumFX.updateRateRange(i, "[Channel" + (i+1) + "]", MixtrackPlatinumFX.pitchRanges[0]);
		
        midi.sendShortMsg(0x80 | i, 0x0A, 0); // down arrow off
        midi.sendShortMsg(0x80 | i, 0x09, 0); // up arrow off
    }
    for (i = 0; i < 2; i++) {
        MixtrackPlatinumFX.effect[i] = new MixtrackPlatinumFX.EffectUnit((i % 2)+1);
	}

    MixtrackPlatinumFX.browse = new MixtrackPlatinumFX.Browse();
    MixtrackPlatinumFX.gains = new MixtrackPlatinumFX.Gains();

    var statusSysex = [0xF0, 0x00, 0x20, 0x7F, 0x03, 0x01, 0xF7];
    midi.sendSysexMsg(statusSysex, statusSysex.length);

    engine.makeConnection("[Channel1]", "VuMeter", MixtrackPlatinumFX.vuCallback);
    engine.makeConnection("[Channel2]", "VuMeter", MixtrackPlatinumFX.vuCallback);
    engine.makeConnection("[Channel3]", "VuMeter", MixtrackPlatinumFX.vuCallback);
    engine.makeConnection("[Channel4]", "VuMeter", MixtrackPlatinumFX.vuCallback);

    engine.makeConnection("[Channel1]", 'rate', MixtrackPlatinumFX.rateCallback).trigger();
    engine.makeConnection("[Channel2]", 'rate', MixtrackPlatinumFX.rateCallback).trigger();
    engine.makeConnection("[Channel3]", 'rate', MixtrackPlatinumFX.rateCallback).trigger();
    engine.makeConnection("[Channel4]", 'rate', MixtrackPlatinumFX.rateCallback).trigger();

    // trigger is needed to initialize lights to 0x01
    MixtrackPlatinumFX.deck.forEachComponent(function(component) {
        component.trigger();
    });
    MixtrackPlatinumFX.effect.forEachComponent(function(component) {
        component.trigger();
    });
    
    // set FX buttons init light)
    midi.sendShortMsg(0x98, 0x00, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x98, 0x01, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x98, 0x02, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x03, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x04, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x05, MixtrackPlatinumFX.LOW_LIGHT);
    
    // setup elapsed/remaining tracking
    engine.makeConnection("[Controls]", "ShowDurationRemaining", MixtrackPlatinumFX.timeElapsedCallback);
	MixtrackPlatinumFX.initComplete=true;
	MixtrackPlatinumFX.updateArrows();
};

MixtrackPlatinumFX.shutdown = function() {
    var shutdownSysex = [0xF0, 0x00, 0x20, 0x7F, 0x02, 0xF7];
	var i;
	
	for (i=0;i<4;i++) {
        // update spinner and position indicator
        midi.sendShortMsg(0xB0 | i, 0x3F, 0);
        midi.sendShortMsg(0xB0 | i, 0x06, 0);
        // keylock indicator
        midi.sendShortMsg(0x80 | i, 0x0D, 0x00);
        // turn off bpm arrows
        midi.sendShortMsg(0x80 | i, 0x0A, 0x00); // down arrow off
        midi.sendShortMsg(0x80 | i, 0x09, 0x00); // up arrow off
		
		MixtrackPlatinumFX.sendScreenRateMidi(i+1,0);
		midi.sendShortMsg(0x90+i, 0x0e, 0);
		MixtrackPlatinumFX.sendScreenBpmMidi(i+1,0);
		MixtrackPlatinumFX.sendScreenTimeMidi(i+1,0);
		MixtrackPlatinumFX.sendScreenDurationMidi(i+1,0);		
	}
	
    midi.sendSysexMsg(shutdownSysex, shutdownSysex.length);
};

MixtrackPlatinumFX.shift = function() {
    MixtrackPlatinumFX.shifted = true;
    MixtrackPlatinumFX.deck.shift();
    MixtrackPlatinumFX.browse.shift();
    MixtrackPlatinumFX.effect.shift();
};

MixtrackPlatinumFX.unshift = function() {
    MixtrackPlatinumFX.shifted = false;
    MixtrackPlatinumFX.deck.unshift();
    MixtrackPlatinumFX.browse.unshift();
    MixtrackPlatinumFX.effect.unshift();
};

MixtrackPlatinumFX.allEffectOff = function() {
    midi.sendShortMsg(0x98, 0x00, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x98, 0x01, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x98, 0x02, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x03, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x04, MixtrackPlatinumFX.LOW_LIGHT);
    midi.sendShortMsg(0x99, 0x05, MixtrackPlatinumFX.LOW_LIGHT);
	MixtrackPlatinumFX.effect[0].effects=[false, false, false];
	MixtrackPlatinumFX.effect[1].effects=[false, false, false];
	MixtrackPlatinumFX.effect[0].updateEffects();
	MixtrackPlatinumFX.effect[1].updateEffects();
};

// TODO in 2.3 it is not possible to "properly" map the FX selection buttons.
// this should be done with load_preset and QuickEffects instead (when effect
// chain preset saving/loading is available in Mixxx)
MixtrackPlatinumFX.EffectUnit = function(deckNumber) {    
    this.effects = [false, false, false];
    this.isSwitchHolded = false;
        
    this.updateEffects = function() {
        if (MixtrackPlatinumFX.toggleFXControlEnable) {
            for (var i = 1; i <= this.effects.length; i++) {            
                engine.setValue("[EffectRack1_EffectUnit" + deckNumber + "_Effect"+i+"]", "enabled", this.effects[i-1]); 
            }
        }
    }
    
    // switch values are:
    // 0 - switch in the middle
    // 1 - switch up
    // 2 - switch down    
    this.enableSwitch = function(channel, control, value, status, group) {
        this.isSwitchHolded = value != 0;

        if (MixtrackPlatinumFX.toggleFXControlSuper) {        
            engine.setValue(group, "super1", Math.min(value, 1.0));
        }
		
		var fxDeck=deckNumber;
		if (!MixtrackPlatinumFX.deck[deckNumber-1].active)
		{
			fxDeck+=2;
		}
		engine.setValue("[EffectRack1_EffectUnit1]", "group_[Channel" + fxDeck + "]_enable", (value != 0));
		engine.setValue("[EffectRack1_EffectUnit2]", "group_[Channel" + fxDeck + "]_enable", (value != 0));
        
        this.updateEffects();
    }

    this.dryWetKnob = new components.Pot({
        group: "[EffectRack1_EffectUnit" + deckNumber + "]",
        inKey: "mix"
    });
    
    this.effect1 = function(channel, control, value, status, group) {
        if (value == 0x7F) {
			if (!MixtrackPlatinumFX.shifted)
			{
				MixtrackPlatinumFX.allEffectOff();
			}
            this.effects[0] = !this.effects[0];
            midi.sendShortMsg(status, control, this.effects[0] ? MixtrackPlatinumFX.HIGH_LIGHT : MixtrackPlatinumFX.LOW_LIGHT);
        }
        
        
        this.updateEffects();
    }
    
    this.effect2 = function(channel, control, value, status, group) {
        if (value == 0x7F) {
			if (!MixtrackPlatinumFX.shifted)
			{
				MixtrackPlatinumFX.allEffectOff();
			}
            this.effects[1] = !this.effects[1];
            midi.sendShortMsg(status, control, this.effects[1] ? MixtrackPlatinumFX.HIGH_LIGHT : MixtrackPlatinumFX.LOW_LIGHT);
        }
        
        this.updateEffects();
    }
    
    this.effect3 = function(channel, control, value, status, group) {
        if (value == 0x7F) {
			if (!MixtrackPlatinumFX.shifted)
			{
				MixtrackPlatinumFX.allEffectOff();
			}
            this.effects[2] = !this.effects[2];
            midi.sendShortMsg(status, control, this.effects[2] ? MixtrackPlatinumFX.HIGH_LIGHT : MixtrackPlatinumFX.LOW_LIGHT);
        }
        
        this.updateEffects();
    }
    
	// copy paste since I'm not sure if we want to handle it like this or not
    this.effectParam = new components.Encoder({
        group: "[EffectRack1_EffectUnit" + deckNumber + "_Effect1]",
        shift: function() {
            this.inKey = "meta";
        },
        unshift: function() {
            this.inKey = "parameter1";
        },
        input: function(channel, control, value) {
            this.inSetParameter(this.inGetParameter() + this.inValueScale(value));
        },
        inValueScale: function(value) {
            return (value < 0x40) ? 0.05 : -0.05;
        }
    });
    this.effectParam2 = new components.Encoder({
        group: "[EffectRack1_EffectUnit" + deckNumber + "_Effect2]",
        shift: function() {
            this.inKey = "meta";
        },
        unshift: function() {
            this.inKey = "parameter1";
        },
        input: function(channel, control, value) {
            this.inSetParameter(this.inGetParameter() + this.inValueScale(value));
        },
        inValueScale: function(value) {
            return (value < 0x40) ? 0.05 : -0.05;
        }
    });
    this.effectParam3 = new components.Encoder({
        group: "[EffectRack1_EffectUnit" + deckNumber + "_Effect3]",
        shift: function() {
            this.inKey = "meta";
        },
        unshift: function() {
            this.inKey = "parameter1";
        },
        input: function(channel, control, value) {
            this.inSetParameter(this.inGetParameter() + this.inValueScale(value));
        },
        inValueScale: function(value) {
            return (value < 0x40) ? 0.05 : -0.05;
        }
    });
};

MixtrackPlatinumFX.EffectUnit.prototype = new components.ComponentContainer();

MixtrackPlatinumFX.Deck = function(number) {
    components.Deck.call(this, number);

    var channel = number - 1;
    var deck = this;
    this.scratchModeEnabled = true;
    this.active = (number == 1 || number == 2);
    
    this.setActive = function(active) {
        this.active = active;

        if (!active) {
            // trigger soft takeover on the pitch control
            this.pitch.disconnect();
        }
    };
    
    this.bpm = new components.Component({
        outKey: "bpm",
        output: function(value, group, control) {
            MixtrackPlatinumFX.sendScreenBpmMidi(number, Math.round(value * 100));
        },
    });
    
    this.duration = new components.Component({
        outKey: "duration",
        output: function(duration, group, control) {
            // update duration
            MixtrackPlatinumFX.sendScreenDurationMidi(number, duration * 1000);

            // when the duration changes, we need to update the play position
            deck.position.trigger();
        },
    });

    this.position = new components.Component({
        outKey: "playposition",
        output: function(playposition, group, control) {
            // the controller appears to expect a value in the range of 0-52
            // representing the position of the track. Here we send a message to the
            // controller to update the position display with our current position.
            var pos = Math.round(playposition * 52);
            if (pos < 0) {
                pos = 0;
            }
            midi.sendShortMsg(0xB0 | channel, 0x3F, pos);

            // get the current duration
            duration = deck.duration.outGetValue();

            // update the time display
            var time = MixtrackPlatinumFX.timeMs(number, playposition, duration);
            MixtrackPlatinumFX.sendScreenTimeMidi(number, time);

            // update the spinner (range 64-115, 52 values)
            //
            // the visual spinner in the mixxx interface takes 1.8 seconds to loop
            // (60 seconds/min divided by 33 1/3 revolutions per min)
            var period = 60 / (33+1/3);
            var midiResolution = 52; // the controller expects a value range of 64-115
            var timeElapsed = duration * playposition;
            var spinner = Math.round(timeElapsed % period * (midiResolution / period));
            if (spinner < 0) {
                spinner += 115;
            } else {
                spinner += 64;
            }

            midi.sendShortMsg(0xB0 | channel, 0x06, spinner);
        },
    });

    this.playButton = new components.PlayButton({
        midi: [0x90 + channel, 0x00],
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x04,
    });
    
    this.playButton_beatgrid = function(channel, control, value, status, group) {
        if (value == 0x7F) {
            engine.setValue(group, "beats_translate_curpos", true);
        }
    };
        

    this.cueButton = new components.CueButton({
        midi: [0x90 + channel, 0x01],
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x04
    });

    this.syncButton = new components.SyncButton({
        midi: [0x90 + channel, 0x02],
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x01
    });

    this.tap = new components.Button({
        key: "bpm_tap",
        midi: [0x88, 0x09]
    });

    this.pflButton = new components.Button({
        shift: function() {
            this.disconnect();
            this.inKey = "slip_enabled";
            this.outKey = "slip_enabled";
            this.connect();
            this.trigger();
        },
        unshift: function() {
            this.disconnect();
            this.inKey = "pfl";
            this.outKey = "pfl";
            this.connect();
            this.trigger();
        },
        type: components.Button.prototype.types.toggle,
        midi: [0x90 + channel, 0x1B],
    });

    this.loadButton = new components.Button({
        shift: function() {
			this.inKey = "eject";
        },
        unshift: function() {
			this.inKey = "LoadSelectedTrack";
        },
    });

    this.volume = new components.Pot({
        inKey: "volume"
    });

    this.treble = new components.Pot({
        group: "[EqualizerRack1_" + this.currentDeck + "_Effect1]",
        inKey: "parameter3"
    });

    this.mid = new components.Pot({
        group: "[EqualizerRack1_" + this.currentDeck + "_Effect1]",
        inKey: "parameter2"
    });

    this.bass = new components.Pot({
        group: "[EqualizerRack1_" + this.currentDeck + "_Effect1]",
        inKey: "parameter1"
    });

    this.filter = new components.Pot({
        group: "[QuickEffectRack1_" + this.currentDeck + "]",
        inKey: "super1"
    });

    this.gain = new components.Pot({
        inKey: "pregain"
    });

    this.pitch = new components.Pot({
        inKey: "rate",
        invert: true
    });
 
    this.padSection = new MixtrackPlatinumFX.PadSection(number);

    this.loop = new components.Button({
        outKey: "loop_enabled",
        midi: [0x94 + channel, 0x40],
        input: function(channel, control, value, status, group) {
            if (!this.isPress(channel, control, value)) {
                return;
            }

            if (!MixtrackPlatinumFX.shifted) {
                if (engine.getValue(group, "loop_enabled") === 0) {
                    script.triggerControl(group, "beatloop_activate");
                } else {
                    script.triggerControl(group, "beatlooproll_activate");
                }
            } else {
                if (engine.getValue(group, "loop_enabled") === 0) {
                    script.triggerControl(group, "reloop_toggle");
                } else {
                    script.triggerControl(group, "reloop_andstop");
                }
            }
        },
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x01
    });

    this.loopHalf = new components.Button({
        midi: [0x94 + channel, 0x34],
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x02,
        shift: function() {
            this.disconnect();
            this.inKey = "loop_in";
            this.outKey = "loop_in";
            this.connect();
            this.trigger();
        },
        unshift: function() {
            this.disconnect();
            this.inKey = "loop_halve";
            this.outKey = "loop_halve";
            this.connect();
            this.trigger();
        }
    });

    this.loopDouble = new components.Button({
        midi: [0x94 + channel, 0x35],
        shiftControl: true,
        sendShifted: true,
        shiftOffset: 0x02,
        shift: function() {
            this.disconnect();
            this.inKey = "loop_out";
            this.outKey = "loop_out";
            this.connect();
            this.trigger();
        },
        unshift: function() {
            this.disconnect();
            this.inKey = "loop_double";
            this.outKey = "loop_double";
            this.connect();
            this.trigger();
        }
    });

    this.scratchToggle = new components.Button({
//         disconnects/connects are needed for the following scenario:
//         1. scratch mode is enabled (light on)
//         2. shift down
//         3. scratch button down
//         4. shift up
//         5. scratch button up
//         scratch mode light is now off, should be on
        key: "reverseroll",
        midi: [0x90 + channel, 0x07],
        unshift: function() {
            this.disconnect(); // disconnect reverseroll light
            this.input = function(channel, control, value) {
                if (!this.isPress(channel, control, value)) {
                    return;
                }
                deck.scratchModeEnabled = !deck.scratchModeEnabled;

                // change the scratch mode status light
                this.send(deck.scratchModeEnabled ? this.on : this.off);
            };
            // set current scratch mode status light
            this.send(deck.scratchModeEnabled ? this.on : this.off);
        },
        sendShifted: false
    });

    this.pitchBendUp = new components.Button({
        shiftControl: true,
        shiftOffset: 0x20,
        shift: function() {
            this.type = components.Button.prototype.types.toggle;
            this.inKey = "keylock";
        },
        unshift: function() {
            this.type = components.Button.prototype.types.push;
            this.inKey = "rate_temp_up";
        }
    });

    this.pitchBendDown = new components.Button({
        currentRangeIdx: 0,
        shift: function() {
            this.input = function(channel, control, value) {
                if (!this.isPress(channel, control, value)) {
                    return;
                }
                this.currentRangeIdx = (this.currentRangeIdx + 1) % MixtrackPlatinumFX.pitchRanges.length;
				MixtrackPlatinumFX.updateRateRange(channel, this.group, MixtrackPlatinumFX.pitchRanges[this.currentRangeIdx]);
            };
        },
        unshift: function() {
            this.inKey = "rate_temp_down";
            this.input = components.Button.prototype.input;
        }
    });

    this.setBeatgrid = new components.Button({
        key: "beats_translate_curpos",
        midi: [0x98 + channel, 0x01 + (channel * 3)]
    });

    this.reconnectComponents(function(component) {
        if (component.group === undefined) {
            component.group = this.currentDeck;
        }
    });
};

MixtrackPlatinumFX.Deck.prototype = new components.Deck();

MixtrackPlatinumFX.PadSection = function(deckNumber) {
    components.ComponentContainer.call(this);

    this.blinkTimer = 0;
    this.blinkLedState = true;

    // initialize leds
    var ledOff = components.Button.prototype.off;
    var ledOn = components.Button.prototype.on;
    midi.sendShortMsg(0x93 + deckNumber, 0x00, ledOn); // hotcue
    midi.sendShortMsg(0x93 + deckNumber, 0x0D, ledOff); // auto loop
    midi.sendShortMsg(0x93 + deckNumber, 0x07, ledOff); // "fader cuts"
    midi.sendShortMsg(0x93 + deckNumber, 0x0B, ledOff); // sample1

    // shifted leds
    midi.sendShortMsg(0x93 + deckNumber, 0x0F, ledOff); // sample2
    midi.sendShortMsg(0x93 + deckNumber, 0x02, ledOff); // beatjump

    this.modes = {};
    this.modes[MixtrackPlatinumFX.PadModeControls.HOTCUE] = new MixtrackPlatinumFX.ModeHotcue(deckNumber);
    this.modes[MixtrackPlatinumFX.PadModeControls.AUTOLOOP] = new MixtrackPlatinumFX.ModeAutoLoop(deckNumber);
    this.modes[MixtrackPlatinumFX.PadModeControls.FADERCUTS] = new MixtrackPlatinumFX.ModeFaderCuts();
    this.modes[MixtrackPlatinumFX.PadModeControls.SAMPLE1] = new MixtrackPlatinumFX.ModeSample(deckNumber, false);
    this.modes[MixtrackPlatinumFX.PadModeControls.BEATJUMP] = new MixtrackPlatinumFX.ModeBeatjump(deckNumber);
    this.modes[MixtrackPlatinumFX.PadModeControls.SAMPLE2] = new MixtrackPlatinumFX.ModeSample(deckNumber, true);
    

    this.modeButtonPress = function(channel, control, value) {
        if (value !== 0x7F) {
            return;
        }
        this.setMode(channel, control);
    };

    this.padPress = function(channel, control, value, status, group) {
        if (this.currentMode.control === MixtrackPlatinumFX.PadModeControls.FADERCUTS) {
            // don't activate pads when in "fader cuts" mode - handled by hardware of firmware
            return;
        }
        var i = (control - 0x14) % 8;
        this.currentMode.pads[i].input(channel, control, value, status, group);
    };

    this.setMode = function(channel, control) {
        var newMode = this.modes[control];
        if (this.currentMode.control === newMode.control) {
            return; // selected mode already set, no need to change anything
        }

        this.currentMode.forEachComponent(function(component) {
            component.disconnect();
        });

        // set the correct shift state for new mode
        if (this.isShifted) {
            newMode.shift();
        } else {
            newMode.unshift();
        }

        newMode.forEachComponent(function(component) {
            component.connect();
            component.trigger();
        });

        if (MixtrackPlatinumFX.enableBlink) {
            // stop blinking if old mode was secondary mode
            if (this.currentMode.secondaryMode) {
                this.blinkLedOff();

                // disable light on the old control in case it ended up in 0x7F state
                midi.sendShortMsg(0x90 + channel, this.currentMode.unshiftedControl, 0x01);
            }

            // start blinking if new mode is a secondary mode
            if (newMode.secondaryMode) {
                this.blinkLedOn(0x90 + channel, newMode.unshiftedControl);
            }
        }

        // light off on old mode select button
        midi.sendShortMsg(0x90 + channel, this.currentMode.control, 0x01);

        // light on on new mode select button
        midi.sendShortMsg(0x90 + channel, newMode.control, newMode.lightOnValue);

        if (newMode.control === MixtrackPlatinumFX.PadModeControls.FADERCUTS) {
            // in "fader cuts" mode pad lights need to be disabled manually,
            // as pads are controlled by hardware or firmware in this mode
            // and don't have associated controls. without this, lights from
            // previously selected mode would still be on after changing mode
            // to "fader cuts"
            this.disablePadLights();
        }

        this.currentMode = newMode;
    };

    // start an infinite timer that toggles led state
    this.blinkLedOn = function(midi1, midi2) {
        this.blinkLedOff();
        this.blinkLedState = true;
        this.blinkTimer = engine.beginTimer(MixtrackPlatinumFX.blinkDelay, function() {
            midi.sendShortMsg(midi1, midi2, this.blinkLedState ? 0x7F : 0x01);
            this.blinkLedState = !this.blinkLedState;
        });
    };

    // stop the blink timer
    this.blinkLedOff = function() {
        if (this.blinkTimer === 0) {
            return;
        }

        engine.stopTimer(this.blinkTimer);
        this.blinkTimer = 0;
    };

    this.disablePadLights = function() {
        for (var i = 0; i < 16; i++) { // 0-7 = unshifted; 8-15 = shifted
            midi.sendShortMsg(0x93 + deckNumber, 0x14 + i, 0x01);
        }
    };

    this.currentMode = this.modes[MixtrackPlatinumFX.PadModeControls.HOTCUE];
};
MixtrackPlatinumFX.PadSection.prototype = Object.create(components.ComponentContainer.prototype);

MixtrackPlatinumFX.ModeHotcue = function(deckNumber) {
    components.ComponentContainer.call(this);

    this.control = MixtrackPlatinumFX.PadModeControls.HOTCUE;
    this.secondaryMode = false;
    this.lightOnValue = 0x7F;

    this.pads = new components.ComponentContainer();
    for (var i = 0; i < 8; i++) {
        this.pads[i] = new components.HotcueButton({
            group: "[Channel" + deckNumber + "]",
            midi: [0x93 + deckNumber, 0x14 + i],
            number: i + 1,
            shiftControl: true,
            sendShifted: true,
            shiftOffset: 0x08,
            outConnect: false
        });
    }
};
MixtrackPlatinumFX.ModeHotcue.prototype = Object.create(components.ComponentContainer.prototype);

MixtrackPlatinumFX.ModeAutoLoop = function(deckNumber) {
    components.ComponentContainer.call(this);

    this.control = MixtrackPlatinumFX.PadModeControls.AUTOLOOP;
    this.secondaryMode = false;
    this.lightOnValue = 0x7F;

    this.pads = new components.ComponentContainer();
    for (var i = 0; i < 8; i++) {
        this.pads[i] = new components.Button({
            group: "[Channel" + deckNumber + "]",
            midi: [0x93 + deckNumber, 0x14 + i],
            size: MixtrackPlatinumFX.autoLoopSizes[i],
            shiftControl: true,
            sendShifted: true,
            shiftOffset: 0x08,
            shift: function() {
                this.inKey = "beatlooproll_" + this.size + "_activate";
                this.outKey = "beatlooproll_" + this.size + "_activate";
            },
            unshift: function() {
                this.inKey = "beatloop_" + this.size + "_toggle";
                this.outKey = "beatloop_" + this.size + "_enabled";
            },
            outConnect: false
        });
    }
};
MixtrackPlatinumFX.ModeAutoLoop.prototype = Object.create(components.ComponentContainer.prototype);

// when pads are in "fader cuts" mode, they rapidly move the crossfader.
// holding a pad activates a "fader cut", releasing it causes the GUI crossfader
// to return to the position of physical crossfader
MixtrackPlatinumFX.ModeFaderCuts = function() {
    components.ComponentContainer.call(this);

    this.control = MixtrackPlatinumFX.PadModeControls.FADERCUTS;
    this.secondaryMode = false;
    this.lightOnValue = 0x09; // for "fader cuts" 0x09 works better than 0x7F for some reason

    // pads are controlled by hardware of firmware in this mode
    // pad input function is not called when pressing a pad in this mode
};
MixtrackPlatinumFX.ModeFaderCuts.prototype = Object.create(components.ComponentContainer.prototype);

MixtrackPlatinumFX.ModeSample = function(deckNumber, secondaryMode) {
    components.ComponentContainer.call(this);

    if (!secondaryMode) {
        // samples 1-8
        this.control = MixtrackPlatinumFX.PadModeControls.SAMPLE1;
        this.firstSampleNumber = 1;
    } else {
        // samples 9-16
        this.control = MixtrackPlatinumFX.PadModeControls.SAMPLE2;
        this.unshiftedControl = MixtrackPlatinumFX.PadModeControls.SAMPLE1;
        this.firstSampleNumber = 9;
    }
    this.secondaryMode = secondaryMode;
    this.lightOnValue = 0x7F;

    this.pads = new components.ComponentContainer();
    for (var i = 0; i < 8; i++) {
        this.pads[i] = new components.SamplerButton({
            midi: [0x93 + deckNumber, 0x14 + i],
            number: this.firstSampleNumber + i,
            shiftControl: true,
            sendShifted: true,
            shiftOffset: 0x08,
            outConnect: false
        });
    }
};
MixtrackPlatinumFX.ModeSample.prototype = Object.create(components.ComponentContainer.prototype);

MixtrackPlatinumFX.ModeBeatjump = function(deckNumber) {
    components.ComponentContainer.call(this);

    this.control = MixtrackPlatinumFX.PadModeControls.BEATJUMP;
    this.secondaryMode = true;
    this.unshiftedControl = MixtrackPlatinumFX.PadModeControls.HOTCUE;
    this.lightOnValue = 0x7F;

    this.pads = new components.ComponentContainer();
    for (var i = 0; i < 8; i++) {
        this.pads[i] = new components.Button({
            group: "[Channel" + deckNumber + "]",
            midi: [0x93 + deckNumber, 0x14 + i],
            size: MixtrackPlatinumFX.beatJumpValues[i],
            shiftControl: true,
            sendShifted: true,
            shiftOffset: 0x08,
            shift: function() {
                this.disconnect();
                this.inKey = "beatjump_" + this.size + "backward";
                this.outKey = "beatjump_" + this.size + "backward";
                this.connect();
                this.trigger();
            },
            unshift: function() {
                this.disconnect();
                this.inKey = "beatjump_" + this.size + "forward";
                this.outKey = "beatjump_" + this.size + "forward";
                this.connect();
                this.trigger();
            },
            outConnect: false
        });
    }
};
MixtrackPlatinumFX.ModeBeatjump.prototype = Object.create(components.ComponentContainer.prototype);

MixtrackPlatinumFX.Browse = function() {
    this.knob = new components.Encoder({
		speed: 0,
		speedTimer: 0,
        shiftControl: true,
        shiftOffset: 0x01,
        input: function(channel, control, value) {
            var direction;
            if (MixtrackPlatinumFX.shifted && MixtrackPlatinumFX.shifBrowseIsZoom) {
				direction = (value > 0x40) ? "up" : "down";
				engine.setParameter("[Channel1]", "waveform_zoom_" + direction, 1);

				// need to zoom both channels if waveform sync is disabled in Mixxx settings.
				// and when it's enabled then no need to zoom 2nd channel, as it will cause
				// the zoom to jump 2 levels at once
				if (!MixtrackPlatinumFX.waveformsSynced) {
					engine.setParameter("[Channel2]", "waveform_zoom_" + direction, 1);
				}
			} else {
				if (this.speedTimer !== 0) {
					engine.stopTimer(this.speedTimer);
					this.speedTimer = 0;
				}
				this.speedTimer = engine.beginTimer(100, function() {
					this.speed=0;
					this.speedTimer = 0;
				}, true);
				this.speed++;
                direction = (value > 0x40) ? value - 0x80 : value;
				if (MixtrackPlatinumFX.shifted)
				{
					// when shifted go fast (consecutive squared!)
					direction *= this.speed*this.speed;
				}
				else
				{
					// normal, up to 3 consecutive do one for fine control, then speed up
					if (this.speed>3)
						direction *= Math.min(4,(this.speed-3));
				}
                engine.setParameter("[Library]", "MoveVertical", direction);
            }
        }
    });

    this.knobButton = new components.Button({
        group: "[Library]",
        shiftControl: true,
        shiftOffset: 0x01,
        shift: function() {
            this.inKey = "GoToItem";
        },
        unshift: function() {
            this.inKey = "MoveFocusForward";
        }
    });
};
MixtrackPlatinumFX.Browse.prototype = new components.ComponentContainer();

MixtrackPlatinumFX.Gains = function() {
    this.mainGain = new components.Pot({
        group: "[Master]",
        inKey: "gain"
    });

    this.cueGain = new components.Pot({
        group: "[Master]",
        inKey: "headGain"
    });

    this.cueMix = new components.Pot({
        group: "[Master]",
        inKey: "headMix"
    });
};
MixtrackPlatinumFX.Gains.prototype = new components.ComponentContainer();

MixtrackPlatinumFX.vuCallback = function(value, group) {
    var level = value * 90;
    var deckOffset = script.deckFromGroup(group) - 1;
    midi.sendShortMsg(0xB0 + deckOffset, 0x1F, level);
};

MixtrackPlatinumFX.wheelTouch = function(channel, control, value) {
    var deckNumber = channel + 1;

    if (!MixtrackPlatinumFX.shifted && MixtrackPlatinumFX.deck[channel].scratchModeEnabled && value === 0x7F) {
        // touch start

        engine.scratchEnable(deckNumber, MixtrackPlatinumFX.jogScratchSensitivity, 33+1/3, MixtrackPlatinumFX.jogScratchAlpha, MixtrackPlatinumFX.jogScratchBeta, true);
    } else if (value === 0) {
        // touch end
        engine.scratchDisable(deckNumber, true);
    }
};

MixtrackPlatinumFX.wheelTurn = function(channel, control, value, status, group) {
    var deckNumber = channel + 1;

    var newValue = value;

    if (value >= 64) {
        // correct the value if going backwards
        newValue -= 128;
    }

    if (MixtrackPlatinumFX.shifted) {
        // seek
        var oldPos = engine.getValue(group, "playposition");

        engine.setValue(group, "playposition", oldPos + newValue / MixtrackPlatinumFX.jogSeekSensitivity);
    } else if (MixtrackPlatinumFX.deck[channel].scratchModeEnabled && engine.isScratching(deckNumber)) {
        // scratch
        engine.scratchTick(deckNumber, newValue);
    } else {
        // pitch bend
        engine.setValue(group, "jog", newValue / MixtrackPlatinumFX.jogPitchSensitivity);
    }
};

MixtrackPlatinumFX.timeElapsedCallback = function(value, group, control) {
    // 0 = elapsed
    // 1 = remaining
    // 2 = both (we ignore this as the controller can't show both)
    var on_off;
    if (value === 0) {
        // show elapsed
        on_off = 0x00;
    } else if (value === 1) {
        // show remaining
        on_off = 0x7F;
    } else {
        // both, ignore the event
        return;
    }

    // update all 4 decks on the controller
    midi.sendShortMsg(0x90, 0x46, on_off);
    midi.sendShortMsg(0x91, 0x46, on_off);
    midi.sendShortMsg(0x92, 0x46, on_off);
    midi.sendShortMsg(0x93, 0x46, on_off);
};

MixtrackPlatinumFX.timeMs = function(deck, position, duration) {
    return Math.round(duration * position * 1000);
};

MixtrackPlatinumFX.encodeNumToArray = function(number, drop, unsigned) {
    var number_array = [
        (number >> 28) & 0x0F,
        (number >> 24) & 0x0F,
        (number >> 20) & 0x0F,
        (number >> 16) & 0x0F,
        (number >> 12) & 0x0F,
        (number >> 8) & 0x0F,
        (number >> 4) & 0x0F,
        number & 0x0F,
    ];

    if (drop !== undefined) {
        number_array.splice(0, drop);
    }

    if (number < 0) number_array[0] = 0x07;
    else if (!unsigned) number_array[0] = 0x08;

    return number_array;
};

MixtrackPlatinumFX.sendScreenDurationMidi = function(deck, duration) {
    if (duration < 1) {
        duration = 1;
    }
    durationArray = MixtrackPlatinumFX.encodeNumToArray(duration - 1);

    var bytePrefix = [0xF0, 0x00, 0x20, 0x7F, deck, 0x03];
    var bytePostfix = [0xF7];
    var byteArray = bytePrefix.concat(durationArray, bytePostfix);
    midi.sendSysexMsg(byteArray, byteArray.length);
};

MixtrackPlatinumFX.sendScreenTimeMidi = function(deck, time) {
    var timeArray = MixtrackPlatinumFX.encodeNumToArray(time);

    var bytePrefix = [0xF0, 0x00, 0x20, 0x7F, deck, 0x04];
    var bytePostfix = [0xF7];
    var byteArray = bytePrefix.concat(timeArray, bytePostfix);
    midi.sendSysexMsg(byteArray, byteArray.length);
};

MixtrackPlatinumFX.sendScreenBpmMidi = function(deck, bpm) {
    bpmArray = MixtrackPlatinumFX.encodeNumToArray(bpm);
    bpmArray.shift();
    bpmArray.shift();

    var bytePrefix = [0xF0, 0x00, 0x20, 0x7F, deck, 0x01];
    var bytePostfix = [0xF7];
    var byteArray = bytePrefix.concat(bpmArray, bytePostfix);
    midi.sendSysexMsg(byteArray, byteArray.length);
	
	MixtrackPlatinumFX.updateArrows();
};

MixtrackPlatinumFX.shiftToggle = function (channel, control, value, status, group) {
    if (value == 0x7F) {
        MixtrackPlatinumFX.shift();
    } else {
        MixtrackPlatinumFX.unshift();
    }
};

MixtrackPlatinumFX.deckSwitch = function (channel, control, value, status, group) {
	// Ignore the release the deck switch callback
	// called both when actually releasing the button and for the alt deck when switching
	if (value)
	{
		var deck = channel;
		MixtrackPlatinumFX.deck[deck].setActive(value == 0x7F); 
		// turn "off" the other deck
		// this can't reliably be done with the release and it also trigger for this deck when the button is released
		var other = 4-deck;
		if (deck==0 || deck==2)
			other = 2-deck;
		MixtrackPlatinumFX.deck[other].setActive(false); 
		// also zero vu meters
		if (value == 0x7F) {
			midi.sendShortMsg(0xBF, 0x44, 0);
			midi.sendShortMsg(0xBF, 0x45, 0);
		}
		MixtrackPlatinumFX.updateArrows();
	}
};

var sendSysex = function(buffer) {
    midi.sendSysexMsg(buffer, buffer.length);
}

MixtrackPlatinumFX.sendScreenRateMidi = function(deck, rate) {
    rateArray = MixtrackPlatinumFX.encodeNumToArray(rate, 2);

    var bytePrefix = [0xF0, 0x00, 0x20, 0x7F, deck, 0x02];
    var bytePostfix = [0xF7];
    var byteArray = bytePrefix.concat(rateArray, bytePostfix);
    sendSysex(byteArray);
};

MixtrackPlatinumFX.updateArrows = function() {
	if (!MixtrackPlatinumFX.initComplete)
	{
		return;
	}
	
	var activeA = MixtrackPlatinumFX.deck[0].active ? 0 : 2;
	var activeB = MixtrackPlatinumFX.deck[1].active ? 1 : 3;

	var bpmA = engine.getValue("[Channel" + (activeA+1) + "]", "bpm");
	var bpmB = engine.getValue("[Channel" + (activeB+1) + "]", "bpm");

	var i;
	for (i=0;i<4;i++)
	{
		var bpmMy = engine.getValue("[Channel" + (i+1) + "]", "bpm");
		var bpmAlt = bpmA;
		if (i==0 || i==2)
		{
			bpmAlt = bpmB;
		}
		
		var down=0;
		var up=0;
		
		// only display if both decks have a bpm
		if (bpmAlt && bpmMy)
		{
			// and have a 0.05 bpm tolerance (else they only go off when you use sync)
			if (bpmAlt>(bpmMy+0.05))
				down=1;
			if (bpmAlt<(bpmMy-0.05))
				up=1;
		}
			
		midi.sendShortMsg(0x80 | i, 0x0A, down); // down arrow off
		midi.sendShortMsg(0x80 | i, 0x09, up); // up arrow off
	}
};

MixtrackPlatinumFX.rateCallback = function(rate, group, control)  {
    var channel = script.deckFromGroup(group) - 1;
    var rateEffective = engine.getValue(group, "rateRange") * -rate;

    MixtrackPlatinumFX.sendScreenRateMidi(channel+1, Math.round(rateEffective*10000));
};

MixtrackPlatinumFX.updateRateRange = function(channel, group, range) {
    //engine.setParameter(group, "rateRange", (range-0.01)*0.25);
    engine.setValue(group, "rateRange", range);
    midi.sendShortMsg(0x90+channel, 0x0e, range*100);
};