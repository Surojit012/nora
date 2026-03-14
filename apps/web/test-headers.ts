try {
  new Headers({
    "x-aptos-message": "APTOS\nmessage: \"Follow 0x123\""
  });
  console.log("Success with newline in header");
} catch(e: any) {
  console.log("Error:", e.message);
}
