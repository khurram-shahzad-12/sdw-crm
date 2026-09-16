cd "C:\SpiceDirect\app\server"
pm2 start ".\src\server.js" --name spice-direct --node-args="--max-old-space-size=8192"
