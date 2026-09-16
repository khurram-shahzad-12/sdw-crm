Start-Process -NoNewWindow -Wait -FilePath "C:\Users\omer\Downloads\mongodb-database-tools-windows-x86_64-100.9.4\bin\mongodump.exe" -ArgumentList "mongodb://localhost:27017","--out C:\Users\omer\Desktop\backup"

Compress-Archive -Path "C:\Users\omer\Desktop\backup\spice_direct" -DestinationPath "C:\Users\omer\Desktop\backup\backup_mongo2.zip" -Force

Copy-Item "C:\Users\omer\Desktop\backup\backup_mongo2.zip" -Destination "G:\My Drive" -Force

Start-Sleep -Seconds 15

Remove-Item "C:\Users\omer\Desktop\backup\*" -Recurse -Force
