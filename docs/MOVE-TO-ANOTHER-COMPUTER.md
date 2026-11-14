# Moving MARSAD to another computer

The website itself lives on GitHub and needs nothing from your computer.
Only the optional "live analysis" runs on a computer of yours. To move it:

1. Install Python 3.12 and Git on the new computer.
2. Download the project:

```bash
git clone https://github.com/oryx-geo/marsad.git
```

3. Install what the server needs (run inside the `marsad` folder):

```bash
python -m pip install -r server/requirements.txt
```

4. Add your Earthdata token in Windows: Start, type `environment`, open "Edit environment variables
   for your account", New, name `EARTHDATA_TOKEN`, paste the token. Never put the token in a file.
5. Install the tunnel and sign in with the same GitHub account as before:

```bash
winget install Microsoft.devtunnel
```

```bash
devtunnel user login -g
```

6. Start it by double-clicking `server/start-server.bat`. The tunnel keeps its address because it
   belongs to your account (`devtunnel list` shows it). If the address in the black window is
   different from the one in `public/live.json`, change that file and push.
7. On the old computer, close the two black windows so only one computer serves the tunnel.

Earthdata tokens last 60 days. When the token expires, create a new one on
https://urs.earthdata.nasa.gov/profile and replace the value in step 4.
