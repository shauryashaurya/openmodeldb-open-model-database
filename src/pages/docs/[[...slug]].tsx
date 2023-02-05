import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { ParsedUrlQuery } from 'querystring';
import { ExternalTextLink } from 'src/elements/link';
import { MarkdownContainer } from 'src/elements/markdown';
import { PageContainer } from 'src/elements/page';
import { SideBarView } from 'src/elements/side-bar';
import { Doc, DocPagePath, docPathToSlug } from 'src/lib/docs/doc';
import { SideBar, generateSideBar } from 'src/lib/docs/side-bar';
import { getAllDocPaths, getAllDocs, getDocFileMetadata, getManifest } from 'src/lib/server/docs';
import style from './docs.module.scss';

interface Params extends ParsedUrlQuery {
    slug?: string[];
}
interface Props {
    title: string;
    markdown: string;
    sideBar: SideBar;
    docPath: DocPagePath;
    lastModified: string;
}

export default function Page({ title, markdown, sideBar, docPath, lastModified }: Props) {
    return (
        <>
            <Head>
                <title>{`${title} - OpenModelDB`}</title>
                <meta
                    content="width=device-width, initial-scale=1"
                    name="viewport"
                />
                <link
                    href="/favicon.ico"
                    rel="icon"
                />
            </Head>
            <PageContainer>
                <div className={style.container}>
                    <div className={style.sideBar}>
                        <SideBarView sideBar={sideBar} />
                    </div>
                    <div className={style.content}>
                        <MarkdownContainer markdown={markdown} />
                        <div className={style.footer}>
                            <div className={style.meta}>
                                <span className={style.lastModified}> {lastModified}</span>
                                <span className={style.edit}>
                                    <ExternalTextLink
                                        href={`https://github.com/OpenModelDB/open-model-database/edit/main/docs/${docPath}`}
                                    >
                                        Edit this page on GitHub
                                    </ExternalTextLink>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

export const getStaticPaths: GetStaticPaths<Params> = async () => {
    const mdPaths = await getAllDocPaths();
    const paths = new Set(mdPaths.map(docPathToSlug));

    return {
        paths: [...paths].map((path) => {
            const segments = path.split(/\//g);
            return { params: { slug: segments } };
        }),
        fallback: false,
    };
};

export const getStaticProps: GetStaticProps<Props, Params> = async (context) => {
    const manifest = await getManifest();

    const slugSegments = context.params?.slug ?? [];
    const slug = slugSegments.join('/');

    const docs = await getAllDocs();
    const [docPath, doc] = getDocFromSlug(slug, docs);

    const { lastModified } = await getDocFileMetadata(docPath);

    return {
        props: {
            title: doc.title,
            markdown: doc.markdown,
            sideBar: generateSideBar(manifest, docs),
            docPath,
            lastModified: formatDate(lastModified),
        },
    };
};

function getDocFromSlug(slug: string, docs: ReadonlyMap<DocPagePath, Doc>): [DocPagePath, Doc] {
    const paths = slug.length === 0 ? ['index.md'] : [`${slug}/index.md`, `${slug}.md`];

    const candidates: [DocPagePath, Doc][] = [];
    for (const pathString of paths) {
        const path = pathString as DocPagePath;
        const d = docs.get(path);
        if (d) {
            candidates.push([path, d]);
        }
    }

    if (candidates.length === 0) {
        throw new Error(`Cannot find a Markdown file for the slug ${slug}`);
    }
    if (candidates.length > 1) {
        console.warn(
            `The slug ${slug} is ambiguous.` +
                ` It maps to following files: ${candidates.map((p) => `'${p[0]}'`).join(', ')}`
        );
    }

    return candidates[0];
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp);

    const yyyy = date.getUTCFullYear();
    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = date.getUTCDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}