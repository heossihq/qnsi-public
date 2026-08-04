/**
 * Published semver from package.json - used for SDK activation metering (must match npm publish).
 */
import metadata from "../package.json" with { type: "json" };

export const SDK_PACKAGE_VERSION: string = metadata.version;
