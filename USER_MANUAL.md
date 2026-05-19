# SmartBuild User Manual

Welcome to **SmartBuild**, your AI-powered assistant for building custom PCs! Whether you are a hardcore gamer, a professional video editor, or just looking for a reliable home office setup, SmartBuild utilizes advanced machine learning (Random Forest model) to recommend the most optimal and compatible PC components tailored specifically to your needs and budget.

This guide will walk you through the process of generating your perfect PC build.

---

## 1. Getting Started

Once the SmartBuild platform is up and running on your machine (or hosted on a server), you can access it via your web browser. 
By default, the application is accessible at `http://localhost:3000/`.

Upon opening the link, you will be greeted by the **Landing Page**, which provides an overview of the system's capabilities.

## 2. Initiating the Recommendation

On the landing page, look for the **"Start recommendation"** button (or similar prompt). Clicking this will navigate you to the **User Input Form** (`/user-input`), where the AI will ask you a series of questions to understand your requirements.

## 3. Providing Your Requirements

To ensure the AI generates the best possible build, you need to provide accurate information regarding your budget and how you plan to use the PC.

### a. Budget Allocation
- **Minimum Budget:** The lowest amount you are willing to spend.
- **Maximum Budget:** Your absolute spending limit. 
*(Note: Your maximum budget must be greater than or equal to your minimum budget. The AI will attempt to maximize performance while staying within this range).*

### b. Primary Activity
Select the main purpose of this PC from the dropdown list. The AI weighs hardware importance differently based on this choice (e.g., Gaming focuses heavily on the GPU, while Video Editing focuses on multi-core CPU performance and RAM).
**Available Options:**
- Browsing & Streaming
- Documents / Office Work
- Gaming
- Video Editing
- Photo / Graphic Design
- 3D Modeling or Animation
- Music Production
- Programming or Development
- Streaming / Recording
- Simulations / Data Analysis

### c. Secondary Activity (Optional)
If you plan to use the PC for a secondary purpose (e.g., you primarily Game but occasionally do Video Editing), you can select a secondary activity. This helps the AI balance the build further.

### d. Expected Longevity
How long do you expect this build to remain highly capable before needing a replacement?
- **1-2 years:** Focuses on current generation performance on a strict budget.
- **3-5 years:** A balanced approach targeting longer usability.
- **5+ years:** Enthusiast tier, focusing on top-tier components that will stay relevant for a long time.

### e. Upgrade Openness (Future-proofing)
Are you open to upgrading components in the future? 
- If **Yes**, the AI may select a newer generation motherboard platform (like AM5) or a higher wattage Power Supply (PSU) to accommodate future, more powerful components.

Once you have filled out all the fields, click the **"Generate Build"** button.

---

## 4. Understanding Your Results

After the AI processes your request, you will be redirected to the **Build Result** page (`/build-result`). Here, you will see a comprehensive breakdown of your recommended PC.

### a. Component Breakdown
The AI will present a list of recommended parts, usually including:
- **CPU (Processor):** The brain of your computer.
- **GPU (Graphics Card):** Responsible for rendering images and video.
- **Motherboard:** Connects all the components together.
- **RAM (Memory):** Temporary storage for active tasks.
- **Storage (SSD/HDD):** Permanent storage for your OS, games, and files.
- **Power Supply (PSU):** Delivers power to all components.
- **Case:** The chassis that holds everything.
- **Cooling (CPU Cooler & Case Fans):** Keeps your components from overheating.

*Each component will be accompanied by its estimated price and why it fits your specific use case.*

### b. Compatibility Check
SmartBuild automatically checks for compatibility issues (e.g., ensuring the CPU fits in the Motherboard socket, the Power Supply provides enough wattage, and the motherboard supports the chosen RAM type). Any specific notes regarding compatibility will be displayed here.

### c. Total Estimated Cost
At the bottom of the build, you will see the total estimated cost, ensuring it falls within your initial budget parameters.

---

## 5. Troubleshooting & Tips

- **"No builds found within budget"**: If your budget is too low for the selected activity (e.g., $300 for high-end 3D Modeling), the AI might not be able to find a suitable build. Try increasing your maximum budget or lowering your longevity expectations.
- **"Invalid input"**: Ensure your maximum budget is higher than your minimum budget and that you have selected a valid Primary Activity.

Enjoy your new SmartBuild custom PC!
