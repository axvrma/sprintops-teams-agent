import { findFieldByName } from "./azureDevOps";

async function main() {
  const searchText = process.argv[2] || "Expected Finish Date";
  const fields = await findFieldByName(searchText);

  if (!fields.length) {
    console.log(`No fields found for: ${searchText}`);
    process.exit(0);
  }

  console.table(
    fields.map((field) => ({
      name: field.name,
      referenceName: field.referenceName,
      type: field.type,
      readOnly: field.readOnly || false,
    }))
  );
}

main().catch((error) => {
  console.error(error.response?.data || error.message);
  process.exit(1);
});
