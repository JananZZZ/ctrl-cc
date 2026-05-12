
import base64, sys, os
def write_file(path, b64_content):
    data = base64.b64decode(b64_content)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)
    print(f'Wrote {len(data)} bytes to {path}')
if __name__ == '__main__':
    write_file(sys.argv[1], sys.argv[2])
