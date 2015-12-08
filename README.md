**DarkFO**, a post-nuclear RPG remake

This is a modern reimplementation of the engine of the video game [Fallout 2](http://en.wikipedia.org/wiki/Fallout_2), as well as a personal research project into the feasibility of doing such.

Status
======

DarkFO is not a complete remake at this time.
A lot of core functionality works, but major parts are missing or need work.

Here is a very rough list of what is known to work:

- Map loading
- Walking, running
- Talking to NPCs
- Bartering
- Some quests (a lot of the scripting works, majors quests can be completed)
- Some party members
- Some skills (lockpicking and repair, and some passive skills)
- Sound (scripted sound effects, music)

Some features are more middle ground:

- Combat works at an extremely basic level but not to a great degree (only the SMG and spear is really tested, you cannot swap ammo, etc.)
- No equippable armor
- The world map is rough and buggy, and on the area screens entrances are misplaced
- Random encounters work, but not all of them are implemented
- Lighting is a big enigma; there is code there for it and it *almost* works, but there is a bug causing large black lines in lit tiles. Also, it is particularly slow, especially outside of the WebGL backend.)
- Some animations are off, particularly related to combat

Some features are not implemented at all:

- Leveling up (including XP, leveling stats/skills, etc.)
- Saving and loading
- The PipBoy map

and other minor features here and there.

Installation
============

To use this, you'll need a few things:

- A copy of Fallout 2 (already installed)

- Python 2.7

- [PIL](http://www.pythonware.com/products/pil/) ([pillow](https://python-pillow.github.io/) may also work, but hasn't been tested)

- [NumPy](http://www.numpy.org/)

- The TypeScript compiler, installed via `npm install -g typescript` (you'll need [node.js](https://nodejs.org/en/)).

If you're testing on Chrome, you'll need a suitable HTTP server due to the way it sandboxes `file://` (I'll recommend LightTPD. On Windows, [grab this .zip](http://en.wlmp-project.net/downloads.php?cat=lighty).You'll need to point its `server.document.root` in `conf/lighttpd.conf` to the DarkFO directory.)

Alternatively, Firefox can load directly from `file://`.

Once you've got all that, you can start trying it out.

Open a command prompt inside the DarkFO directory, and then run:

    python setup.py path/to/Fallout2/installation/directory

This will take a few minutes, it's unpacking the game archives and converting relevant game data into a format DarkFO can use.

Then run `tsc` to compile the source code.

Browse to `http://localhost/play.html?artemple` (or whatever port you're using). If all went well, it should begin the game. If not, check the JavaScript console for errors.

Review `src/config.ts` for engine options. Be sure to re-compile if you change them.

OPTIONAL: If you want sound, run `python convertAudio.py`. You'll need the `acm2wav` tool (you can get it from No Mutants Allowed).

License
=======

DarkFO is licensed under the terms of the Apache 2 license. See `LICENSE.txt` for the full license text.

Contributing
============

Contributions are welcome!

Testing is more than welcome: if you have issues running DarkFO, or if you find bugs, glitches, or other inaccuracies, please don't hesitate to file an issue on GitHub and/or contact the developers!

To contribute code, simply submit a pull request with your changes. Take care to write sensible commit messages, and if you want to change major parts of the code, please discuss it with other developers first (see the Contact section below).
 

Thanks!

Contact
=======

If you have an issue, please file it in the GitHub issue tracker.
If you'd like to join us in discussion, visit us on IRC at `#darkfo` on FreeNode (`irc.freenode.net`)!