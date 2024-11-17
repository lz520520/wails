# Bindings Generator Guide

## Introduction

One of the key features of Wails is the ability to seamlessly integrate backend Go code with the frontend, enabling
efficient communication between the two. This can be done manually by sending messages between the frontend and
backend, but this can be cumbersome and error-prone, especially when dealing with complex data types.

The bindings generator in Wails v3 simplifies this process by automatically generating JavaScript or TypeScript
functions and models that reflect the methods and data structures defined in your Go code. This means you can write
your backend logic in Go and easily expose it to the frontend without the need for manual binding or complex integration.

This guide is designed to help you understand and utilise this powerful binding tool.

## Core Concepts

In Wails v3, services can be added to your application. These services act as a bridge between the backend and frontend,
allowing you to define methods and state that can be accessed and manipulated from the frontend.

### Services

1. Services can hold state and expose methods that operate on that state.
2. Services can be used similar to controllers in HTTP web applications or as services.
3. Only public methods on the service are bound, following Go's convention.

Here's a simple example of how you can define a service and add it to your Wails application:

```go
package main

import (
    "log"
    "github.com/wailsapp/wails/v3/pkg/application"
)

type GreetService struct {}

func (g *GreetService) Greet(name string) string {
    return "Hello " + name
}

func main() {
    app := application.New(application.Options{
		Services: []application.Service{
			application.NewService(&GreetService{}),
		},
    })
    // ....
    err := app.Run()
    if err != nil {
        log.Fatal(err)
    }
}
```

In this example, we define a `GreetService` services with a public `Greet` method. The `Greet` method takes a `name`
parameter and returns a greeting string.

We then create a new Wails application using `application.New` and add the `GreetService` service to the
application using the `Services` option in the `application.Options`. The `application.NewService` method must always be given an *instance* of
the service struct, not the service struct type itself.

### Generating the Bindings

By binding the struct, Wails is able to generate the necessary JavaScript or TypeScript code by running the following
command in the project directory:

```bash
wails3 generate bindings
```
The bindings generator will scan the project and dependencies for anything that needs generating.
Note: It will take longer the very first time you run the bindings generator, as it will be building up a cache of
packages to scan.
You should see output similar to the following:

```bash
% wails3 generate bindings
 INFO  347 Packages, 1 Service, 1 Method, 0 Enums, 0 Models in 1.981036s.
 INFO  Output directory: /Users/me/myproject/frontend/bindings
```
If we look in the `frontend/bindings` directory, we should see the following files:

```bash
frontend/bindings
└── changeme
    ├── greetservice.js
    └── index.js
```

NOTE: The `changeme` directory is the name of the module defined in `go.mod` and is used to namespace the generated
files. 

The generated `greetservice.js` file contains the JavaScript code that mirrors the Go struct and its methods:

```javascript
// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import {Call as $Call, Create as $Create} from "@wailsio/runtime";

/**
 * @param {string} name
 * @returns {Promise<string> & { cancel(): void }}
 */
export function Greet(name) {
    let $resultPromise = /** @type {any} */($Call.ByID(1411160069, name));
    return $resultPromise;
}
```
As you can see, it also generates all the necessary JSDoc type information to ensure type safety in your frontend code.

### Using the Bindings

You can import and use this file in your frontend code to interact with the backend.

```javascript
import { Greet } from './bindings/changeme/greetservice.js';

console.log(Greet('Alice')); // Output: Hello Alice
```

### Binding Models

In addition to binding methods, you can also use structs as input or output parameters in your bound methods. When structs are used as parameters, Wails generates corresponding JavaScript versions of those types.

Let's extend the previous example to use a `Person` type that has a `Name` field:

```go
package main

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"log"
)

// Person defines a person
type Person struct {
	// Name of the person
	Name string
}

type GreetService struct{}

func (g *GreetService) Greet(person Person) string {
	return "Hello " + person.Name
}

func main() {
	app := application.New(application.Options{
		Services: []application.Service{
			application.NewService(&GreetService{}),
		},
	})
	// ....
	app.NewWebviewWindow()
	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}

```

In this updated example, we define a `Person` struct with a `Name` field. The `Greet` method in the `GreetService` service
now takes a `Person` as an input parameter.

When you run the bindings generator, Wails will generate a corresponding JavaScript `Person` type that mirrors the Go
struct. This allows you to create instances of the `Person` type in your frontend code and pass them to the bound
`Greet` method.

If we run the bindings generator again, we should see the following output:

```bash
% wails3 generate bindings
 INFO  Processed: 347 Packages, 1 Service, 1 Method, 0 Enums, 1 Model in 1.9943997s.
 INFO  Output directory: /Users/me/myproject/frontend/bindings
```

In the `frontend/bindings/changeme` directory, you should see a new `models.js` file containing the following code:

```javascript
// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import {Create as $Create} from "@wailsio/runtime";

/**
 * Person defines a person
 */
export class Person {
    /**
     * Creates a new Person instance.
     * @param {Partial<Person>} [$$source = {}] - The source object to create the Person.
     */
    constructor($$source = {}) {
        if (!("Name" in $$source)) {
            /**
             * Name of the person
             * @member
             * @type {string}
             */
            this["Name"] = "";
        }

        Object.assign(this, $$source);
    }

    /**
     * Creates a new Person instance from a string or object.
     * @param {any} [$$source = {}]
     * @returns {Person}
     */
    static createFrom($$source = {}) {
        let $$parsedSource = typeof $$source === 'string' ? JSON.parse($$source) : $$source;
        return new Person(/** @type {Partial<Person>} */($$parsedSource));
    }
}


```

The `Person` class is generated with a constructor that takes an optional `source` parameter, which allows you to
create a new `Person` instance from an object. It also has a static `createFrom` method that can create a `Person`
instance from a string or object.

You may also notice that comments in the Go struct are kept in the generated JavaScript code! This can be helpful for
understanding the purpose of the fields and methods in the generated models and should be picked up by your IDE.

### Using Bound Models

Here's an example of how you can use the generated JavaScript `Person` type in your frontend code:

```javascript
import {Greet} from "./bindings/changeme/GreetService.js";
import {Person} from "./bindings/changeme/models.js";

const resultElement = document.getElementById('result');

async function doGreet() {
    let person = new Person({Name: document.getElementById('name').value});
    if (!person.Name) {
        person.Name = 'anonymous';
    }
    resultElement.innerText = await Greet(person);
}
```

In this example, we import the generated `Person` type from the `models` module. We create a new instance of `Person`,
set its `Name` property, and pass it to the `Greet` method.

Using bound models allows you to work with complex data structures and seamlessly pass them between the frontend and
backend of your Wails application.

### Using Typescript

To generate TypeScript bindings instead of JavaScript, you can use the `-ts` flag:

```bash
% wails3 generate bindings -ts
```

This will generate TypeScript files in the `frontend/bindings` directory:

```bash
frontend/bindings
└── main
   ├── greetservice.ts
   ├── index.ts
   └── models.ts
````

The generated files include `greetservice.ts`, which contains the TypeScript code for the bound struct and its methods,
and `models.ts`, which contains the TypeScript types for the bound models:

```typescript title="GreetService.ts"
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import {Call as $Call, Create as $Create} from "@wailsio/runtime";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unused imports
import * as $models from "./models.js";

export function Greet(person: $models.Person): Promise<string> & { cancel(): void } {
    let $resultPromise = $Call.ByID(1411160069, person) as any;
    return $resultPromise;
}

```

```typescript title="models.ts"
// @ts-check
// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT

/**
 * Person defines a person
 */
export class Person {
    /**
     * Name of the person
     */
    "Name": string;

    /** Creates a new Person instance. */
    constructor(source: Partial<Person> = {}) {
        if (!("Name" in source)) {
            this["Name"] = "";
        }

        Object.assign(this, source);
    }

    /** Creates a new Person instance from a string or object. */
    static createFrom(source: string | object = {}): Person {
        let parsedSource = typeof source === 'string' ? JSON.parse(source) : source;
        return new Person(parsedSource as Partial<Person>);
    }
}
```

Using TypeScript bindings provides type safety and improved IDE support when working with the generated code in your frontend.