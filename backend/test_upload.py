import urllib.request, mimetypes, os

file_path = 'test.wav'
boundary = 'wL36Yn8afVp8Ag7AmP8qZ0SA4n1v9T'
with open(file_path, 'rb') as f:
    file_content = f.read()

body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="test.wav"\r\n'
    f'Content-Type: audio/wav\r\n\r\n'
).encode('utf-8') + file_content + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:8000/api/v1/jobs', data=body)
req.add_header('Content-type', f'multipart/form-data; boundary={boundary}')

try:
    print(urllib.request.urlopen(req).read().decode('utf-8'))
except Exception as e:
    print(e.read().decode('utf-8'))
