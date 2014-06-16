**DarkFO**, a post-apocalyptic nuclear RPG remake

This is a clone of the video game [Fallout 2](http://en.wikipedia.org/wiki/Fallout_2), as well as a personal research project into the feasibility of doing such.

To use this, you'll need a few things:

- A copy of Fallout 2

- Extracted Fallout 2 game data (you might want to use [this tool](http://www.nma-fallout.com/downloads.php?do=file&id=661), extract `master.dat` and `critters.dat` into a directory called `data/`.)

- Python 2.7 and `pip`

- Install Construct 2 via `pip install construct`

- Install [PIL](http://www.pythonware.com/products/pil/) (`pillow` may also work.)

- [NumPy](http://www.numpy.org/)

- A suitable HTTP server (I'll recommend LightTPD. On Windows, [grab this .zip](http://en.wlmp-project.net/downloads.php?cat=lighty). You'll need to point its `server.document.root` in `conf/lighttpd.conf` to the DarkFO directory.)

Once you've got all that, you can start trying it out. I'll assume you're in a command prompt inside the the DarkFO directory:

- Run `python exportImages.py <data>/color.pal <data> art`. Where <data> is the combined folder of the original FO2 assets combined with the extracted ones. This will take a while (~30 minutes) as it's converting all of the relevant images from the Fallout 2 format.

- Run `python buildPRO.py`

- Copy over a map from `data/maps/` such as `GECKSETL.map` into `maps/`

- Run `python fo2map.py maps/GECKSETL.map` (or whichever map you've chosen.)

- Edit the `MAP_NAME` in `play.html` to the name of your map (sans the `.map` extension.)

- Browse to `http://localhost/play.html`. If all went well, it should display your map. If not, check the JavaScript console for errors.