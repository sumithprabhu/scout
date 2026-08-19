/**
 * Live check for the Nova/Bedrock JD parser. Needs AWS creds + Nova model access.
 *   npx tsx scripts/test-parse.ts
 * Sends a sample JD to parseJD and prints the structured result. On any auth /
 * access error it prints a low-confidence empty result (the parser never throws)
 * — if you see empty + low confidence, check AWS creds and Bedrock model access.
 */
import "dotenv/config";
import { parseJD } from "../lib/jdParser";

const SAMPLE = `
Senior Backend Engineer

We're hiring a backend engineer to build our payments platform. You'll design
and ship services in Go, deploy on Kubernetes, and work with PostgreSQL and Redis.
Experience with gRPC and Kafka is a strong plus. Familiarity with AWS is nice to have.
You should have 5+ years of experience and be comfortable owning services end to end.
`;

async function main() {
  console.log("Region:", process.env.BEDROCK_REGION || "us-east-1");
  console.log("Model :", process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0");
  console.log("Parsing sample JD...\n");

  const result = await parseJD(SAMPLE);
  console.log(JSON.stringify(result, null, 2));

  if (result.parseConfidence === "low" && result.requiredSkills.length === 0) {
    console.log(
      "\n⚠ Low-confidence empty result. If the JD text looks fine, this usually means:\n" +
        "  - AWS creds missing/invalid, or IAM lacks bedrock:InvokeModel\n" +
        "  - Nova model access not enabled in the Bedrock console for this region\n" +
        "  - wrong BEDROCK_MODEL_ID (try us.amazon.nova-lite-v1:0)\n" +
        "  Check the [jdParser] error line above for the exact cause."
    );
  } else {
    console.log("\n✓ Parser is working.");
  }
}

main().catch((e) => {
  console.error("test-parse failed:", e);
  process.exit(1);
});
