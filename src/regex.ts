const regex = /(?<=https:\/\/github\.com).*/

export function getGithubRegURL(url: string) {
    const res = url.match(regex)
    if (res) {
        return res[0]
    } else {
        return undefined
    }
}