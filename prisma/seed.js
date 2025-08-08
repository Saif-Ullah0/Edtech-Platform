// backend/prisma/seed.js - Complete seed matching your full schema
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting complete database seeding...');

  // =====================================
  // USERS
  // =====================================
  
  // Create admin user
  let adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      status: 'ACTIVE',
      canCreatePublicBundles: true
    }
  });

  // Create regular user (student)
  let regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  // Create test user
  let testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      name: 'Test Student',
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  console.log('✅ Users created');

  // =====================================
  // CATEGORIES
  // =====================================
  
  const webDevCategory = await prisma.category.upsert({
    where: { slug: 'web-development' },
    update: {},
    create: {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Learn modern web development technologies',
      imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&h=400&fit=crop'
    }
  });

  const dataCategory = await prisma.category.upsert({
    where: { slug: 'data-science' },
    update: {},
    create: {
      name: 'Data Science',
      slug: 'data-science',
      description: 'Analyze data and build machine learning models',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
    }
  });

  const mobileCategory = await prisma.category.upsert({
    where: { slug: 'mobile-development' },
    update: {},
    create: {
      name: 'Mobile Development',
      slug: 'mobile-development',
      description: 'Build mobile applications for iOS and Android',
      imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=400&fit=crop'
    }
  });

  console.log('✅ Categories created');

  // Clean existing data for fresh seed
  console.log('🧹 Cleaning existing data...');
  await prisma.chapterProgress.deleteMany({});
  await prisma.chapter.deleteMany({});
  await prisma.moduleProgress.deleteMany({});
  await prisma.moduleEnrollment.deleteMany({});
  await prisma.bundlePurchase.deleteMany({});
  await prisma.bundleItem.deleteMany({});
  await prisma.courseBundleItem.deleteMany({});
  await prisma.bundle.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.course.deleteMany({});

  // =====================================
  // COURSES
  // =====================================
  
  console.log('📚 Creating courses...');

  // FREE COURSE - Python Basics
  const pythonCourse = await prisma.course.create({
    data: {
      title: 'Python Programming Complete',
      slug: 'python-programming-complete',
      description: 'Learn Python programming from scratch. Master variables, functions, loops, and build real projects. Perfect for beginners starting their coding journey.',
      price: 0,
      imageUrl: 'https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: false,
      categoryId: dataCategory.id
    }
  });

  // MIXED COURSE - React Development
  const reactCourse = await prisma.course.create({
    data: {
      title: 'React Development Mastery',
      slug: 'react-development-mastery',
      description: 'Master React development with hooks, state management, and modern patterns. Build professional web applications from scratch.',
      price: 199.99,
      imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: true,
      categoryId: webDevCategory.id
    }
  });

  // PREMIUM COURSE - Full Stack
  const fullStackCourse = await prisma.course.create({
    data: {
      title: 'Full Stack Developer Bootcamp',
      slug: 'fullstack-developer-bootcamp',
      description: 'Complete web development course covering frontend, backend, databases, and deployment. Become a professional full-stack developer.',
      price: 399.99,
      imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: true,
      categoryId: webDevCategory.id
    }
  });

  console.log('✅ Courses created');

  // =====================================
  // MODULES & CHAPTERS - PYTHON COURSE (FREE)
  // =====================================
  
  console.log('📖 Creating Python course modules and chapters...');

  // Module 1: Python Fundamentals
  const pythonMod1 = await prisma.module.create({
    data: {
      title: 'Python Fundamentals',
      description: 'Learn the basics of Python programming including syntax, variables, and data types.',
      slug: 'python-fundamentals',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  // Module 1 Chapters
  const pythonCh1 = await prisma.chapter.create({
    data: {
      title: 'What is Python?',
      description: 'Introduction to Python programming language and its applications.',
      content: '<h2>Welcome to Python!</h2><p>Python is a high-level, interpreted programming language known for its simplicity and readability.</p><h3>Why Learn Python?</h3><ul><li>Easy to learn and use</li><li>Versatile - used in web development, data science, AI</li><li>Large community and extensive libraries</li><li>High demand in job market</li></ul><h3>What We\'ll Cover</h3><p>In this course, you\'ll learn:</p><ul><li>Python basics and syntax</li><li>Variables and data types</li><li>Control structures (if statements, loops)</li><li>Functions and modules</li><li>File handling and data processing</li></ul>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 600,
      moduleId: pythonMod1.id
    }
  });

  const pythonCh2 = await prisma.chapter.create({
    data: {
      title: 'Installing Python',
      description: 'Step-by-step guide to install Python on your computer.',
      content: '<h2>Installing Python</h2><p>Let\'s get Python installed on your system so you can start coding!</p><h3>Windows Installation:</h3><ol><li>Visit <a href="https://python.org">python.org</a></li><li>Download Python 3.x (latest version)</li><li>Run the installer</li><li><strong>Important:</strong> Check "Add Python to PATH"</li><li>Click "Install Now"</li></ol><h3>Mac Installation:</h3><ol><li>Install using Homebrew: <code>brew install python</code></li><li>Or download from python.org</li></ol><h3>Verify Installation:</h3><p>Open terminal/command prompt and type:</p><pre><code>python --version</code></pre><p>You should see something like "Python 3.x.x"</p>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      order: 2,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 900,
      moduleId: pythonMod1.id
    }
  });

  const pythonCh3 = await prisma.chapter.create({
    data: {
      title: 'Your First Python Program',
      description: 'Write and run your very first Python program.',
      content: '<h2>Hello, World!</h2><p>Let\'s write your first Python program together!</p><pre><code>print("Hello, World!")\nprint("Welcome to Python programming!")\nprint("This is exciting!")</code></pre><h3>Understanding the Code:</h3><ul><li><code>print()</code> is a built-in function that displays text</li><li>Text must be in quotes (strings)</li><li>Each line is executed from top to bottom</li></ul><h3>Try This:</h3><p>Create a file called <code>hello.py</code> and add the code above. Run it with:</p><pre><code>python hello.py</code></pre><h3>Congratulations! 🎉</h3><p>You just wrote and ran your first Python program!</p>',
      order: 3,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 450,
      moduleId: pythonMod1.id
    }
  });

  // Module 2: Variables and Data Types
  const pythonMod2 = await prisma.module.create({
    data: {
      title: 'Variables and Data Types',
      description: 'Master Python variables, strings, numbers, and basic data structures.',
      slug: 'variables-data-types',
      type: 'VIDEO',
      orderIndex: 2,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  const pythonCh4 = await prisma.chapter.create({
    data: {
      title: 'Understanding Variables',
      description: 'Learn how to create and use variables in Python.',
      content: '<h2>Variables in Python</h2><p>Variables are like containers that store data values. Think of them as labeled boxes!</p><h3>Creating Variables:</h3><pre><code># Text (strings)\nname = "Alice"\nfavorite_color = "blue"\n\n# Numbers (integers)\nage = 25\nscore = 100\n\n# Decimal numbers (floats)\nheight = 5.8\nprice = 19.99\n\n# True/False values (booleans)\nis_student = True\nhas_pets = False</code></pre><h3>Variable Rules:</h3><ul><li>Names should be descriptive</li><li>Use lowercase with underscores</li><li>Can\'t start with numbers</li><li>No spaces allowed</li></ul><h3>Try This:</h3><pre><code>your_name = "Your Name Here"\nyour_age = 20\nprint(f"Hello, I am {your_name} and I am {your_age} years old")</code></pre>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1200,
      moduleId: pythonMod2.id
    }
  });

  const pythonCh5 = await prisma.chapter.create({
    data: {
      title: 'Working with Numbers',
      description: 'Mathematical operations and number handling in Python.',
      content: '<h2>Numbers and Math in Python</h2><p>Python makes working with numbers easy and intuitive!</p><h3>Types of Numbers:</h3><pre><code># Integers (whole numbers)\ncount = 42\ntemperature = -10\nyear = 2024\n\n# Floats (decimal numbers)\nprice = 29.99\npi = 3.14159\nweight = 68.5</code></pre><h3>Math Operations:</h3><pre><code># Basic arithmetic\nresult = 10 + 5    # Addition = 15\nresult = 10 - 3    # Subtraction = 7\nresult = 6 * 7     # Multiplication = 42\nresult = 15 / 3    # Division = 5.0\nresult = 17 // 3   # Floor division = 5\nresult = 17 % 3    # Modulus (remainder) = 2\nresult = 2 ** 3    # Exponent (2 to power 3) = 8</code></pre><h3>Practical Examples:</h3><pre><code># Calculate area of rectangle\nlength = 10\nwidth = 5\narea = length * width\nprint(f"Area: {area} square units")\n\n# Convert temperature\ncelsius = 25\nfahrenheit = (celsius * 9/5) + 32\nprint(f"{celsius}°C = {fahrenheit}°F")</code></pre>',
      order: 2,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 800,
      moduleId: pythonMod2.id
    }
  });

  const pythonCh6 = await prisma.chapter.create({
    data: {
      title: 'String Magic',
      description: 'Master text manipulation and string operations.',
      content: '<h2>Working with Strings</h2><p>Strings are everywhere in programming - user input, file names, messages, and more!</p><h3>Creating Strings:</h3><pre><code># Different ways to create strings\nfirst_name = "John"\nlast_name = \'Doe\'\nmessage = """This is a\nmulti-line string"""\n\n# Combining strings\nfull_name = first_name + " " + last_name\ngreeting = f"Hello, {full_name}!"  # f-strings (modern way)</code></pre><h3>Useful String Methods:</h3><pre><code>text = "  Python Programming  "\n\n# Cleaning up text\nclean = text.strip()        # Remove spaces: "Python Programming"\nupper = text.upper()        # "  PYTHON PROGRAMMING  "\nlower = text.lower()        # "  python programming  "\n\n# Finding and replacing\nposition = text.find("Python")    # Returns 2\nnew_text = text.replace("Python", "Java")\n\n# Checking content\nis_digit = "123".isdigit()      # True\nis_alpha = "Hello".isalpha()    # True</code></pre><h3>Real-World Example:</h3><pre><code># User input processing\nuser_input = "  JOHN DOE  "\nclean_name = user_input.strip().title()\nprint(f"Welcome, {clean_name}!")  # "Welcome, John Doe!"</code></pre>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_3mb.mp4',
      order: 3,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1000,
      moduleId: pythonMod2.id
    }
  });

  // Module 3: Control Structures
  const pythonMod3 = await prisma.module.create({
    data: {
      title: 'Control Structures',
      description: 'Make decisions and repeat actions with if statements and loops.',
      slug: 'control-structures',
      type: 'TEXT',
      orderIndex: 3,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  const pythonCh7 = await prisma.chapter.create({
    data: {
      title: 'Making Decisions with If Statements',
      description: 'Learn how to make your programs intelligent with conditional logic.',
      content: '<h2>If Statements - Making Decisions</h2><p>If statements allow your program to make decisions based on conditions. This is where your code becomes intelligent!</p><h3>Basic If Statement:</h3><pre><code>age = 18\n\nif age >= 18:\n    print("You are an adult")\n    print("You can vote!")\nelse:\n    print("You are a minor")\n    print("Wait a few more years")</code></pre><h3>Multiple Conditions:</h3><pre><code>score = 85\n\nif score >= 90:\n    grade = "A"\n    print("Excellent work!")\nelif score >= 80:\n    grade = "B"\n    print("Good job!")\nelif score >= 70:\n    grade = "C"\n    print("Not bad!")\nelif score >= 60:\n    grade = "D"\n    print("You can do better!")\nelse:\n    grade = "F"\n    print("Study harder next time!")\n\nprint(f"Your grade: {grade}")</code></pre><h3>Combining Conditions:</h3><pre><code>weather = "sunny"\ntemperature = 25\n\n# Using AND\nif weather == "sunny" and temperature > 20:\n    print("Perfect day for a picnic!")\n\n# Using OR\nif weather == "rainy" or temperature < 10:\n    print("Better stay inside")\n\n# Using NOT\nif not weather == "stormy":\n    print("Safe to go outside")</code></pre>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 950,
      moduleId: pythonMod3.id
    }
  });

  const pythonCh8 = await prisma.chapter.create({
    data: {
      title: 'Loops - Repeating Actions',
      description: 'Learn to repeat code efficiently with for and while loops.',
      content: '<h2>Loops - Automation at its Best!</h2><p>Loops help you repeat actions without writing the same code over and over. They\'re essential for automation!</p><h3>For Loops - When you know how many times:</h3><pre><code># Count from 0 to 4\nfor i in range(5):\n    print(f"Count: {i}")\n\n# Count from 1 to 10\nfor i in range(1, 11):\n    print(f"Number: {i}")\n\n# Loop through a list\nfruits = ["apple", "banana", "orange", "grape"]\nfor fruit in fruits:\n    print(f"I like {fruit}")\n\n# Loop through text\nfor letter in "HELLO":\n    print(letter)</code></pre><h3>Practical Examples:</h3><pre><code># Calculate total\nnumbers = [10, 25, 30, 45, 20]\ntotal = 0\nfor number in numbers:\n    total = total + number\nprint(f"Total: {total}")  # Total: 130\n\n# Find even numbers\nfor i in range(1, 21):\n    if i % 2 == 0:\n        print(f"{i} is even")</code></pre><h3>While Loops - When you don\'t know how many times:</h3><pre><code># Keep asking until correct answer\npassword = ""\nwhile password != "secret123":\n    password = input("Enter password: ")\n    if password != "secret123":\n        print("Wrong password, try again!")\n        \nprint("Access granted!")</code></pre>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_4mb.mp4',
      order: 2,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1400,
      moduleId: pythonMod3.id
    }
  });

  console.log('✅ Python course modules and chapters created');

  // =====================================
  // MODULES & CHAPTERS - REACT COURSE (MIXED)
  // =====================================
  
  console.log('⚛️ Creating React course modules and chapters...');

  // Module 1: React Introduction (FREE)
  const reactMod1 = await prisma.module.create({
    data: {
      title: 'React Introduction',
      description: 'Free introduction to React concepts and modern JavaScript.',
      slug: 'react-introduction',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh1 = await prisma.chapter.create({
    data: {
      title: 'What is React?',
      description: 'Introduction to React library and modern web development.',
      content: '<h2>Welcome to React!</h2><p>React is a powerful JavaScript library for building user interfaces, created by Facebook and used by millions of developers worldwide.</p><h3>What Makes React Special?</h3><ul><li><strong>Component-Based:</strong> Build encapsulated components that manage their own state</li><li><strong>Virtual DOM:</strong> React creates an in-memory virtual DOM for fast updates</li><li><strong>One-Way Data Flow:</strong> Data flows down, actions flow up</li><li><strong>Learn Once, Write Anywhere:</strong> Use React for web, mobile, and desktop</li></ul><h3>Who Uses React?</h3><p>React powers some of the world\'s most popular applications:</p><ul><li>Facebook and Instagram</li><li>Netflix and Airbnb</li><li>Uber and WhatsApp</li><li>Dropbox and Discord</li></ul><h3>What You\'ll Learn</h3><p>By the end of this course, you\'ll master:</p><ul><li>React components and JSX</li><li>State and props management</li><li>Hooks and modern React patterns</li><li>Building real-world applications</li></ul>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 600,
      moduleId: reactMod1.id
    }
  });

  const reactCh2 = await prisma.chapter.create({
    data: {
      title: 'Modern JavaScript Primer',
      description: 'Essential JavaScript features you need for React.',
      content: '<h2>JavaScript for React</h2><p>Before diving into React, let\'s review the modern JavaScript features you\'ll use constantly.</p><h3>Arrow Functions:</h3><pre><code>// Old way\nfunction greet(name) {\n  return "Hello " + name;\n}\n\n// Modern way\nconst greet = (name) => {\n  return `Hello ${name}`;\n}\n\n// Even shorter\nconst greet = name => `Hello ${name}`;</code></pre><h3>Destructuring:</h3><pre><code>// Array destructuring\nconst [first, second] = ["React", "Vue"];\n\n// Object destructuring\nconst user = { name: "John", age: 30 };\nconst { name, age } = user;\n\n// In function parameters\nconst greetUser = ({ name, age }) => {\n  return `${name} is ${age} years old`;\n};</code></pre><h3>Template Literals:</h3><pre><code>const name = "React";\nconst version = 18;\n\n// Old way\nconst message = "Welcome to " + name + " version " + version;\n\n// Modern way\nconst message = `Welcome to ${name} version ${version}`;</code></pre><h3>Spread Operator:</h3><pre><code>// Arrays\nconst fruits = ["apple", "banana"];\nconst moreFruits = [...fruits, "orange", "grape"];\n\n// Objects\nconst user = { name: "John", age: 30 };\nconst updatedUser = { ...user, age: 31 };</code></pre>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
      order: 2,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1200,
      moduleId: reactMod1.id
    }
  });

  // Module 2: React Setup (PAID)
  const reactMod2 = await prisma.module.create({
    data: {
      title: 'React Environment Setup',
      description: 'Professional React development environment and tooling.',
      slug: 'react-setup',
      type: 'VIDEO',
      orderIndex: 2,
      price: 49.99,
      isFree: false,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh3 = await prisma.chapter.create({
    data: {
      title: 'Setting Up Create React App',
      description: 'Create your first React project with modern tooling.',
      content: '<h2>Your First React Project</h2><p>Create React App is the official way to bootstrap React applications with zero configuration.</p><h3>Prerequisites:</h3><ul><li>Node.js (version 14 or higher)</li><li>npm or yarn package manager</li><li>A code editor (VS Code recommended)</li></ul><h3>Creating Your Project:</h3><pre><code># Create new React app\nnpx create-react-app my-first-app\n\n# Navigate to project\ncd my-first-app\n\n# Start development server\nnpm start</code></pre><p>This will open your browser to http://localhost:3000 with a spinning React logo!</p><h3>Project Structure:</h3><pre><code>my-first-app/\n├── public/\n│   ├── index.html\n│   └── favicon.ico\n├── src/\n│   ├── App.js\n│   ├── App.css\n│   ├── index.js\n│   └── index.css\n└── package.json</code></pre><h3>Understanding the Files:</h3><ul><li><code>public/index.html</code> - The single page of your SPA</li><li><code>src/index.js</code> - Entry point that renders your app</li><li><code>src/App.js</code> - Your main App component</li></ul>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_3mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1500,
      moduleId: reactMod2.id
    }
  });

  const reactCh4 = await prisma.chapter.create({
    data: {
      title: 'VS Code for React Development',
      description: 'Configure VS Code with essential React extensions and settings.',
      content: '<h2>VS Code Setup for React</h2><p>Let\'s configure VS Code to be the perfect React development environment.</p><h3>Essential Extensions:</h3><ul><li><strong>ES7+ React/Redux/React-Native snippets</strong> - Quick code snippets</li><li><strong>Auto Rename Tag</strong> - Automatically rename paired HTML/JSX tags</li><li><strong>Bracket Pair Colorizer</strong> - Color matching brackets</li><li><strong>Prettier</strong> - Code formatter</li><li><strong>ESLint</strong> - Code linting and error detection</li></ul><h3>Useful Snippets:</h3><pre><code>// Type "rafce" and press Tab\nimport React from \'react\'\n\nconst ComponentName = () => {\n  return (\n    <div>ComponentName</div>\n  )\n}\n\nexport default ComponentName\n\n// Type "useState" and press Tab\nconst [state, setState] = useState(initialValue)</code></pre><h3>Productivity Settings:</h3><pre><code>// settings.json\n{\n  "editor.formatOnSave": true,\n  "editor.codeActionsOnSave": {\n    "source.fixAll.eslint": true\n  },\n  "emmet.includeLanguages": {\n    "javascript": "javascriptreact"\n  }\n}</code></pre><h3>Pro Tips:</h3><ul><li>Use Ctrl+` to open integrated terminal</li><li>Ctrl+Shift+P opens command palette</li><li>Alt+Click for multiple cursors</li><li>Ctrl+D selects next occurrence</li></ul>',
      order: 2,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 800,
      moduleId: reactMod2.id
    }
  });

  // Module 3: Advanced React (PREMIUM)
  const reactMod3 = await prisma.module.create({
    data: {
      title: 'Advanced React Patterns',
      description: 'Master advanced React concepts including hooks, context, and performance optimization.',
      slug: 'advanced-react',
      type: 'VIDEO',
      orderIndex: 3,
      price: 99.99,
      isFree: false,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh5 = await prisma.chapter.create({
    data: {
      title: 'React Context API Mastery',
      description: 'Master global state management with React Context.',
      content: '<h2>Context API - Global State Management</h2><p>The Context API provides a way to pass data through the component tree without having to pass props down manually at every level.</p><h3>When to Use Context:</h3><ul><li>User authentication status</li><li>Theme settings (dark/light mode)</li><li>Language preferences</li><li>Shopping cart contents</li></ul><h3>Creating a Context:</h3><pre><code>// contexts/AuthContext.js\nimport { createContext, useContext, useState } from \'react\';\n\nconst AuthContext = createContext();\n\nexport const AuthProvider = ({ children }) => {\n  const [user, setUser] = useState(null);\n  const [isLoading, setIsLoading] = useState(false);\n\n  const login = async (email, password) => {\n    setIsLoading(true);\n    try {\n      const response = await api.login(email, password);\n      setUser(response.user);\n    } catch (error) {\n      console.error(\'Login failed:\', error);\n    } finally {\n      setIsLoading(false);\n    }\n  };\n\n  const logout = () => {\n    setUser(null);\n  };\n\n  const value = {\n    user,\n    isLoading,\n    login,\n    logout\n  };\n\n  return (\n    <AuthContext.Provider value={value}>\n      {children}\n    </AuthContext.Provider>\n  );\n};\n\nexport const useAuth = () => {\n  const context = useContext(AuthContext);\n  if (!context) {\n    throw new Error(\'useAuth must be used within AuthProvider\');\n  }\n  return context;\n};</code></pre>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 2100,
      moduleId: reactMod3.id
    }
  });

  console.log('✅ React course modules and chapters created');

  // =====================================
  // NOTES/MATERIALS
  // =====================================
  
  console.log('📄 Creating course notes and materials...');

  // Python course notes
  await prisma.note.create({
    data: {
      title: 'Python Cheat Sheet',
      slug: 'python-cheat-sheet',
      description: 'Quick reference guide for Python syntax and common operations.',
      content: 'Complete Python reference with examples and best practices.',
      fileUrl: 'https://example.com/python-cheat-sheet.pdf',
      fileName: 'python-cheat-sheet.pdf',
      fileSize: '2.5 MB',
      fileType: 'application/pdf',
      isPublished: true,
      orderIndex: 1,
      courseId: pythonCourse.id,
      moduleId: pythonMod1.id
    }
  });

  await prisma.note.create({
    data: {
      title: 'Python Installation Guide',
      slug: 'python-installation-guide',
      description: 'Detailed installation instructions for Windows, Mac, and Linux.',
      content: 'Step-by-step installation guide with screenshots.',
      fileUrl: 'https://example.com/python-install-guide.pdf',
      fileName: 'python-install-guide.pdf',
      fileSize: '1.8 MB',
      fileType: 'application/pdf',
      isPublished: true,
      orderIndex: 2,
      courseId: pythonCourse.id
    }
  });

  // React course notes
  await prisma.note.create({
    data: {
      title: 'React Hooks Reference',
      slug: 'react-hooks-reference',
      description: 'Complete guide to all React hooks with examples.',
      content: 'Comprehensive React hooks documentation and examples.',
      fileUrl: 'https://example.com/react-hooks-guide.pdf',
      fileName: 'react-hooks-guide.pdf',
      fileSize: '3.2 MB',
      fileType: 'application/pdf',
      isPublished: true,
      orderIndex: 1,
      courseId: reactCourse.id,
      moduleId: reactMod3.id
    }
  });

  console.log('✅ Course notes created');

  // =====================================
  // ENROLLMENTS & ACCESS
  // =====================================
  
  console.log('👥 Creating user enrollments...');

  // Enroll regular user in Python course (FREE)
  const pythonEnrollment = await prisma.enrollment.create({
    data: {
      userId: regularUser.id,
      courseId: pythonCourse.id,
      progress: 45.0,
      paymentTransactionId: null // Free course
    }
  });

  // Enroll test user in React course (PAID)
  const reactEnrollment = await prisma.enrollment.create({
    data: {
      userId: testUser.id,
      courseId: reactCourse.id,
      progress: 25.0,
      paymentTransactionId: 'txn_react_001'
    }
  });

  console.log('✅ Enrollments created');

  // =====================================
  // MODULE ENROLLMENTS (Individual Purchases)
  // =====================================
  
  console.log('💳 Creating module enrollments...');

  // Regular user has access to React introduction (free module)
  await prisma.moduleEnrollment.create({
    data: {
      userId: regularUser.id,
      moduleId: reactMod1.id,
      progress: 100.0,
      completed: true,
      purchasePrice: 0,
      paymentTransactionId: null
    }
  });

  // Test user purchased React setup module
  await prisma.moduleEnrollment.create({
    data: {
      userId: testUser.id,
      moduleId: reactMod2.id,
      progress: 60.0,
      completed: false,
      purchasePrice: 49.99,
      paymentTransactionId: 'txn_module_001'
    }
  });

  console.log('✅ Module enrollments created');

  // =====================================
  // CHAPTER PROGRESS
  // =====================================
  
  console.log('📊 Creating chapter progress...');

  // Regular user progress in Python course
  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh1.id,
      isCompleted: true,
      watchTime: 600,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh2.id,
      isCompleted: true,
      watchTime: 900,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh3.id,
      isCompleted: false,
      watchTime: 200,
      completionPercentage: 44.0
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh4.id,
      isCompleted: false,
      watchTime: 480,
      completionPercentage: 40.0
    }
  });

  // Test user progress in React course
  await prisma.chapterProgress.create({
    data: {
      userId: testUser.id,
      chapterId: reactCh1.id,
      isCompleted: true,
      watchTime: 600,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: testUser.id,
      chapterId: reactCh2.id,
      isCompleted: false,
      watchTime: 800,
      completionPercentage: 66.7
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: testUser.id,
      chapterId: reactCh3.id,
      isCompleted: false,
      watchTime: 600,
      completionPercentage: 40.0
    }
  });

  console.log('✅ Chapter progress created');

  // =====================================
  // BUNDLES
  // =====================================
  
  console.log('📦 Creating sample bundles...');

  const webDevBundle = await prisma.bundle.create({
    data: {
      name: 'Web Development Complete Bundle',
      description: 'Master both React and Full Stack development with this comprehensive bundle.',
      userId: adminUser.id,
      totalPrice: 599.98, // reactCourse.price + fullStackCourse.price
      discount: 25, // 25% discount
      finalPrice: 449.99,
      type: 'COURSE',
      isActive: true,
      isFeatured: true,
      isPopular: true,
      isPublic: true,
      salesCount: 15,
      revenue: 6749.85,
      viewCount: 245
    }
  });

  // Add courses to bundle
  await prisma.courseBundleItem.create({
    data: {
      bundleId: webDevBundle.id,
      courseId: reactCourse.id
    }
  });

  await prisma.courseBundleItem.create({
    data: {
      bundleId: webDevBundle.id,
      courseId: fullStackCourse.id
    }
  });

  console.log('✅ Bundles created');

  // =====================================
  // SUMMARY
  // =====================================
  
  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Complete Test Data Summary:');
  console.log('='.repeat(50));
  
  console.log('\n👥 Users:');
  console.log('  - admin@example.com / admin123 (Admin)');
  console.log('  - user@example.com / user123 (Student with Python course access)');
  console.log('  - test@example.com / test123 (Student with React course access)');
  
  console.log('\n📚 Courses:');
  console.log(`  1. "${pythonCourse.title}" (ID: ${pythonCourse.id}) - FREE`);
  console.log('     - 3 modules, 8 chapters');
  console.log('     - Complete content with video and text');
  console.log('     - Progress tracking for user@example.com');
  
  console.log(`  2. "${reactCourse.title}" (ID: ${reactCourse.id}) - MIXED PRICING`);
  console.log('     - 3 modules (1 free, 2 paid)');
  console.log('     - 5 chapters with advanced content');
  console.log('     - Module-level purchases available');
  
  console.log(`  3. "${fullStackCourse.title}" (ID: ${fullStackCourse.id}) - PREMIUM`);
  console.log('     - Premium course for bundle testing');
  
  console.log('\n🧪 Perfect for Testing:');
  console.log('='.repeat(50));
  console.log('✅ Complete Learning Interface');
  console.log(`  - Free Course: http://localhost:3000/courses/${pythonCourse.id}/learn`);
  console.log(`  - Mixed Course: http://localhost:3000/courses/${reactCourse.id}/learn`);
  
  console.log('\n✅ User Access Scenarios');
  console.log('  - user@example.com: Full access to Python + partial React');
  console.log('  - test@example.com: Full React access with purchase history');
  
  console.log('\n✅ Content Variety');
  console.log('  - Text chapters with rich HTML content');
  console.log('  - Video chapters with progress tracking');
  console.log('  - Course materials and downloadable notes');
  
  console.log('\n✅ Progress Tracking');
  console.log('  - Chapter-level progress with completion percentages');
  console.log('  - Watch time tracking for videos');
  console.log('  - Module completion status');
  
  console.log('\n✅ Payment Features');
  console.log('  - Free course access');
  console.log('  - Individual module purchases');
  console.log('  - Course bundles with discounts');
  
  console.log('\n🎯 Test Everything:');
  console.log('='.repeat(50));
  console.log('1. Login with different users');
  console.log('2. Navigate through course → modules → chapters');
  console.log('3. Test video playback and progress tracking');
  console.log('4. Check access control (free vs paid content)');
  console.log('5. Verify responsive design on mobile');
  console.log('6. Test chapter navigation and auto-advance');
  
  console.log('\n🚀 Ready to test the complete learning experience!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });