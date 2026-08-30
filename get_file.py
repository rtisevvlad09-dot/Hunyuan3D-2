import base64
import os

with open("/app/florista-app.zip", "rb") as f:
    encoded_string = base64.b64encode(f.read()).decode("utf-8")

with open("/app/encoded.txt", "w") as f:
    f.write(encoded_string)
