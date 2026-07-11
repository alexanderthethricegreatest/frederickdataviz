import { atlas, fmtI, pctS } from "@/lib/data";
import { PageHead } from "@/components/Kit";
import CountyMap from "@/components/CountyMap";

export const metadata = { title: "Map · Growth Atlas" };

export default function MapPage() {
  const a = atlas;
  return (
    <>
      <PageHead eyebrow="The county, mapped" title="Where every home, business, and application landed."
        stats={[
          { v: fmtI(a.consumes.total), l: "Mapped new dwellings" },
          { v: fmtI(a.commerce.total), l: "C/I permits" },
          { v: fmtI(a.applications.total), l: "Applications" },
          { v: pctS(a.serve.residential.pct_out_swsa), l: "Homes outside service area", cls: "crit" },
        ]}>
        The data the county keeps in siloed portals, on one map. Switch layers, filter by year,
        and toggle the growth-area and service boundaries, then click any application to follow it through approval.
      </PageHead>
      <main className="wrap">
        <section className="blk">
          <CountyMap />
        </section>
      </main>
    </>
  );
}
