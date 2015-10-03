**DarkFO**, a post-apocalyptic nuclear RPG remake

This is a modern reimplementation of the engine of the video game [Fallout 2](http://en.wikipedia.org/wiki/Fallout_2), as well as a personal research project into the feasibility of doing such.

To use this, you'll need a few things:

- A copy of Fallout 2

- Python 2.7 and `pip`

- Install Construct 2 via `pip install construct`

- Install [PIL](http://www.pythonware.com/products/pil/) (`pillow` may also work.)

- Install [NumPy](http://www.numpy.org/)

- Install the TypeScript compiler via `npm install -g typescript` (you'll need [node.js](https://nodejs.org/en/)).

- A suitable HTTP server (I'll recommend LightTPD. On Windows, [grab this .zip](http://en.wlmp-project.net/downloads.php?cat=lighty). You'll need to point its `server.document.root` in `conf/lighttpd.conf` to the DarkFO directory.) Alternatively, Firefox can load directly from `file://`.

Once you've got all that, you can start trying it out. I'll assume you're in a command prompt inside the the DarkFO directory:

- Unpack your game's `.dat` files:

    Run: `python dat2.py path/to/fallout2/master.dat data`

    and then: `python dat2.py path/to/fallout2/critter.dat data`

    This will only take a couple of minutes while it unpacks the game archives into `data/`.

- Run `python exportImages.py data/color.pal data art`. This will take a while (~10 minutes) as it's converting all of the relevant images from the Fallout 2 format into PNGs.

- Run `python buildPRO.py`

- OPTIONAL: If you want sound, run `python convertAudio.py`. You'll need the `acm2wav` tool (you can get it from No Mutants Allowed). 

- Run `python fo2map.py data/maps/gecksetl.map` (or whichever map you want to run, substituting `gecksetl` here.)

- Run `tsc *.ts` to compile the source code.

- Browse to `http://localhost/play.html?mapname`, where `mapname` is the extensionless name of a converted map (e.g. `gecksetl`). If all went well, it should display your map. If not, check the JavaScript console for errors.

Review `config.ts` for engine options. Be sure to re-compile if you change them.