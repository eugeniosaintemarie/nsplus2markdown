import json
import base64
from urllib.parse import quote

# Crear el contenido del proyecto
project = {
    "name": "Test Project",
    "meta": {
        "version": "1.0",
        "created": "2024-01-01"
    },
    "diagrams": [
        {
            "name": "Test Diagram",
            "theClass": "com.example.TestClass",
            "code": '<input type="hidden" value="public class TestClass { public void test() { } }" />'
        }
    ]
}

# Codificar
project_json = json.dumps(project)
escaped_json = quote(project_json)
binary_data = escaped_json.encode('utf-8').decode('latin1')
encoded = base64.b64encode(binary_data.encode('latin1')).decode('utf-8')
reversed_data = encoded[::-1]

# Crear el envelope
envelope = {
    "data": reversed_data
}

# Guardar
with open('test.nsplus', 'w') as f:
    json.dump(envelope, f)

print("test.nsplus creado correctamente")
print(f"Contenido: {json.dumps(envelope, indent=2)[:200]}...")
